<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class AttendanceController extends Controller
{
    private const TEAM_LABELS   = ['2' => 'A', '3' => 'B', '4' => 'C'];
    private const ALL_SHIFT_IDS = [15, 16, 9, 10, 21, 22, 11, 12, 17, 18];

    // ── Confirmed business rules ──────────────────────────────────
    // Headcount = 15 (day) + 16 (night) + 9 (Scheduled OT day) + 10 (Scheduled OT night)
    //             + 21 (Holiday OT day) + 22 (Holiday OT night)
    private const WORK_SHIFT_IDS    = [15, 16, 9, 10, 21, 22];
    // True rest day — always excluded from headcount/absent/late, regardless of check-in
    private const RESTDAY_SHIFT_IDS = [11, 12];
    // Scheduled OT worked ON a rest day — conditional: counts toward headcount
    // ONLY if the employee actually checked in. A no-show on optional rest-day
    // OT is just a rest day, not an absence.
    private const OT_SHIFT_IDS = [9, 10];
    // Used only for the wrong-schedule/late punctuality check
    private const DAY_TYPE_SHIFT_IDS   = [15, 9, 21];
    private const NIGHT_TYPE_SHIFT_IDS = [16, 10, 22];

    private function isRestdayShift(int $shiftId): bool
    {
        return in_array($shiftId, self::RESTDAY_SHIFT_IDS, true);
    }

    private function isWorkShift(int $shiftId): bool
    {
        return in_array($shiftId, self::WORK_SHIFT_IDS, true);
    }

    /**
     * Whether an employee should be treated as "restday" for headcount
     * purposes, given their shift and whether they checked in.
     *
     *  - True rest day (11,12):        always restday.
     *  - Scheduled OT restday (9,10):  restday ONLY if they did NOT check in.
     *                                  If they checked in, they worked the
     *                                  OT and count as normal headcount.
     *  - Everything else (15,16,21,22, and unclassified 17,18): never restday.
     */
    private function isEffectiveRestday(int $shiftId, bool $isPresent): bool
    {
        if (in_array($shiftId, self::RESTDAY_SHIFT_IDS, true)) {
            return true;
        }
        if (in_array($shiftId, self::OT_SHIFT_IDS, true) && !$isPresent) {
            return true;
        }
        return false;
    }

    /**
     * Classify a checked-in employee's punctuality against their shift.
     *
     * Day-type shifts (15,9,21) start 07:00:
     *   <= 07:00       → on_time
     *   07:01 - 18:59  → late
     *   >= 19:00       → wrong_schedule (checked in like a night-shift worker)
     *
     * Night-type shifts (16,10,22) start 19:00:
     *   <= 07:00       → wrong_schedule (checked in like a day-shift worker)
     *   07:01 - 19:00  → on_time
     *   >= 19:01       → late
     *
     * Shift IDs outside both lists (e.g. 17, 18) have no defined rule yet —
     * treated as on_time so they are never mis-flagged.
     */
    private function classifyPunctuality(int $shiftId, string $checkIn): string
    {
        if (in_array($shiftId, self::DAY_TYPE_SHIFT_IDS, true)) {
            if ($checkIn >= '19:00:00') return 'wrong_schedule';
            if ($checkIn >= '07:01:00') return 'late';
            return 'on_time';
        }

        // Restday shifts — same windows as their day/night equivalents
        if ($shiftId === 11) { // RD Dayshift — starts 07:00
            if ($checkIn >= '19:00:00') return 'wrong_schedule';
            if ($checkIn >= '07:01:00') return 'late';
            return 'on_time';
        }

        if (in_array($shiftId, self::NIGHT_TYPE_SHIFT_IDS, true)) {
            if ($checkIn <= '07:00:00') return 'wrong_schedule';
            if ($checkIn >= '19:01:00') return 'late';
            return 'on_time';
        }

            if ($shiftId === 12) { // RD Nightshift — starts 19:00, same window as night shifts
            // 05:00-16:59 = wrong schedule (day hours) | 17:00-19:00 = on time (early) | 00:00-04:59 = on time (still night)
            if ($checkIn >= '05:00:00' && $checkIn < '17:00:00') return 'wrong_schedule';
            if ($checkIn >= '19:01:00') return 'late';
            return 'on_time';
        }
        return 'on_time';
    }

    private function loadShiftMap(): array
    {
        $rows = DB::connection('scheduler')
            ->table('shift_codes')
            ->whereIn('SHIFT_CODE_ID', self::ALL_SHIFT_IDS)
            ->select('SHIFT_CODE_ID','SHIFTCODE','SHIFTCODE_DESC','TIME_WINDOWS')
            ->get();

        $map = [];
        foreach ($rows as $r) {
            $windows = json_decode($r->TIME_WINDOWS, true);
            if (!$windows || empty($windows[0])) continue;

            $startTime   = $windows[0]; // e.g. "07:00" or "19:00"
            $startHour   = (int)explode(':', $startTime)[0];
            $isDay       = $startHour >= 7 && $startHour < 19;
            $lateAfter   = Carbon::createFromFormat('H:i', $startTime)->addMinute()->format('H:i:s');


            $map[$r->SHIFT_CODE_ID] = [
                'type'        => $isDay ? 'day' : 'night',
                'start'       => $startTime.':00',
                'end'         => isset($windows[7]) ? $windows[7].':00' : null,
                'late_after'  => $lateAfter,
                'shiftcode'   => $r->SHIFTCODE,
                'desc'        => $r->SHIFTCODE_DESC,
            ];
        }
        return $map;
    }

    public function summary(Request $request)
    {
        set_time_limit(180);
        DB::statement("SET SESSION eq_range_index_dive_limit = 0");

        $from    = $request->get('from', now()->toDateString());
        $to      = $request->get('to',   now()->toDateString());
        $factory = $request->get('factory', null);
        $team    = $request->get('team', null);

        $shiftMap = $this->loadShiftMap();

        // ── 1. Get ALL active employees per factory/team ──────────
        $empQuery = DB::connection('masterlist')
            ->table('employee_masterlist')
            ->where('ACCSTATUS', '1')
            ->whereIn('TEAM', ['2', '3', '4'])
            ->select('EMPID','EMPLOYID','TEAM','Factory','PRODLINE');

        if ($factory && $factory !== 'All') {
            $empQuery->where('Factory', $factory);
        }
        if ($team) {
            $teamCode = array_search($team, self::TEAM_LABELS);
            if ($teamCode) $empQuery->where('TEAM', $teamCode);
        }

        $employees  = $empQuery->get();
        $employids  = $employees->pluck('EMPLOYID')->map(fn($e) => (string)(int)$e)->toArray();
        // work_scheduler.EMPID stores EMPLOYID (biometric ID), not internal EMPID
        $empByEmployid = $employees->keyBy(fn($e) => (string)(int)$e->EMPLOYID);

        if (empty($employids)) {
            return response()->json(['by_day'=>[],'summary'=>[],'total_hc'=>0]);
        }

        // ── 2. Get work schedules (work_scheduler.EMPID = EMPLOYID) ───────────
        $schedulers = DB::connection('scheduler')
            ->table('work_scheduler')
            ->whereIn('WORK_SCHED_STATUS', [1, 2, 3])
            ->where('PAYROLL_DATE_START','<=',$to)
            ->where('PAYROLL_DATE_END','>=',$from)
            ->whereIn('EMPID', array_map('intval', $employids))
            ->select('EMPID','SCHEDULE','PAYROLL_DATE_START','PAYROLL_DATE_END')
            ->orderBy('ID', 'desc')
            ->get()
            ->unique('EMPID'); // keep latest (highest ID) per EMPID

        // ── 2b. Fallback: most recent schedule for uncovered employees ─────────
        $coveredEmployids = $schedulers->pluck('EMPID')->map(fn($e)=>(string)(int)$e)->unique()->toArray();
        $uncoveredEmployids = array_values(array_diff($employids, $coveredEmployids));

        $fallbackSchedulers = collect();
        if (!empty($uncoveredEmployids)) {
            $inList = implode(',', array_map('intval', $uncoveredEmployids));
            $fallbackSchedulers = collect(DB::connection('scheduler')->select(
                "SELECT ws.EMPID, ws.SCHEDULE, ws.PAYROLL_DATE_START, ws.PAYROLL_DATE_END
                 FROM hr_calendar.work_scheduler ws
                 INNER JOIN (
                     SELECT EMPID, MAX(PAYROLL_DATE_END) as max_end
                     FROM hr_calendar.work_scheduler
                     WHERE EMPID IN ($inList)
                     AND WORK_SCHED_STATUS IN (1,2,3)
                     GROUP BY EMPID
                 ) latest ON ws.EMPID = latest.EMPID
                         AND ws.PAYROLL_DATE_END = latest.max_end
                 WHERE ws.WORK_SCHED_STATUS IN (1,2,3)"
            ));
        }
        // Extend date range to capture night shift check-ins from previous evening
        $dateFrom = \Carbon\Carbon::parse($from)->subDay()->format('Y-m-d') . ' 19:00:00';
        $dateTo   = $to . ' 23:59:59';
        $eidList  = "'".implode("','", $employids)."'";

        $logsManual = DB::connection('qdn_db')->select(
            "SELECT employid, DATE(datetime) as log_date, MIN(TIME(datetime)) as first_checkin
             FROM dtr.biometric_logs_manual
             WHERE punch_type = 'check_in' AND datetime BETWEEN ? AND ?
             AND employid IN ($eidList)
             GROUP BY employid, DATE(datetime)",
            [$dateFrom, $dateTo]
        );

        $logsBio = DB::connection('qdn_db')->select(
            "SELECT employid, DATE(datetime) as log_date, MIN(TIME(datetime)) as first_checkin
             FROM dtr.biometric_logs
             WHERE punch_type = 'check_in' AND datetime BETWEEN ? AND ?
             AND employid IN ($eidList)
             GROUP BY employid, DATE(datetime)",
            [$dateFrom, $dateTo]
        );

        $checkInMap = [];
        foreach (array_merge($logsManual, $logsBio) as $log) {
            $logDate   = $log->log_date;
            $checkInTime = $log->first_checkin;
            // Night shift check-ins from previous evening (>=19:00) belong to the NEXT day
            if ($checkInTime >= '19:00:00') {
                $logDate = \Carbon\Carbon::parse($logDate)->addDay()->format('Y-m-d');
            }
            $key = (string)(int)$log->employid . '|' . $logDate;
            if (!isset($checkInMap[$key]) || $checkInTime < $checkInMap[$key]) {
                $checkInMap[$key] = $checkInTime;
            }
        }

        // ── 4. Get approved leaves ────────────────────────────────
        $leaves = DB::connection('masterlist')->select(
            "SELECT EMPLOYID, DATESTART, DATEEND, TYPEOFLEAVE
             FROM leavesys_new_db.employee_leaves
             WHERE LEAVESTATUS = 'APPROVED'
             AND DATEEND >= ? AND DATESTART <= ?
             AND EMPLOYID IN ($eidList)",
            [$from, $to]
        );

        $leaveSet = [];
        foreach ($leaves as $lv) {
            $s = Carbon::parse($lv->DATESTART);
            $e = Carbon::parse($lv->DATEEND);
            for ($d = $s->copy(); $d->lte($e); $d->addDay()) {
                $leaveSet[(string)(int)$lv->EMPLOYID . '|' . $d->toDateString()] = $lv->TYPEOFLEAVE;
            }
        }

        // ── 5. Build per-day results ──────────────────────────────
        $start       = Carbon::parse($from);
        $end         = Carbon::parse($to);
        $byDay       = [];
        $teamSummary = [];
        $today       = now()->toDateString();

        for ($d = $start->copy(); $d->lte($end); $d->addDay()) {
            $dateStr = $d->toDateString();
            $isToday = $dateStr === $today;

            // Build empShift: EMPLOYID => shift info
            $empShift = [];

            // First pass: use current period schedulers
            foreach ($schedulers as $s) {
                $periodStart = Carbon::parse($s->PAYROLL_DATE_START);
                $periodEnd   = Carbon::parse($s->PAYROLL_DATE_END);
                if ($d->lt($periodStart) || $d->gt($periodEnd)) continue;

                $schedule = json_decode($s->SCHEDULE, true);
                if (!$schedule) continue;

                $dayOfPeriod = (string)($periodStart->diffInDays($d) + 1);
                if (!isset($schedule[$dayOfPeriod])) continue;

                $shiftId = (int)$schedule[$dayOfPeriod];
                if ($shiftId === 0 || !isset($shiftMap[$shiftId])) continue;

                $emp = $empByEmployid[(string)$s->EMPID] ?? null;
                if (!$emp) continue;

                $empShift[(string)(int)$emp->EMPLOYID] = [
                    'type'        => $shiftMap[$shiftId]['type'],
                    'late_after'  => $shiftMap[$shiftId]['late_after'],
                    'shift_id'    => $shiftId,
                    'scheduled'   => true,
                ];
            }

            // Second pass: fallback to most recent schedule using day-of-week
            // A payroll period is typically 15 days, so use day-of-week position
            foreach ($fallbackSchedulers as $s) {
                $emp = $empByEmployid[(string)$s->EMPID] ?? null;
                if (!$emp) continue;

                $employid = (string)(int)$emp->EMPLOYID;
                if (isset($empShift[$employid])) continue; // already assigned

                $schedule = json_decode($s->SCHEDULE, true);
                if (!$schedule) continue;

                $periodLength = count($schedule);
                if ($periodLength === 0) continue;

                // KEY FIX: use current period start (Sep 7) not historical (Aug 22)
                // so day position matches what covered employees have
                $refStart = null;
                foreach ($schedulers as $cs) {
                    $cps = \Carbon\Carbon::parse($cs->PAYROLL_DATE_START);
                    $cpe = \Carbon\Carbon::parse($cs->PAYROLL_DATE_END);
                    if ($d->gte($cps) && $d->lte($cpe)) { $refStart = $cps; break; }
                }
                if (!$refStart) $refStart = \Carbon\Carbon::parse($s->PAYROLL_DATE_START);

                $daysSinceStart = $refStart->diffInDays($d);
                $dayOfPeriod    = (string)(($daysSinceStart % $periodLength) + 1);

                if (!isset($schedule[$dayOfPeriod])) $dayOfPeriod = '1';
                if (!isset($schedule[$dayOfPeriod])) continue;

                $shiftId = (int)$schedule[$dayOfPeriod];
                if ($shiftId === 0 || !isset($shiftMap[$shiftId])) continue;

                $empShift[$employid] = [
                    'type'        => $shiftMap[$shiftId]['type'],
                    'late_after'  => $shiftMap[$shiftId]['late_after'],
                    'shift_id'    => $shiftId,
                    'scheduled'   => false, // fallback — not confirmed schedule
                ];
            }

            // Team-rotation inference: reassign fallback employees to majority shift
            foreach (['A','B','C'] as $tl) {
                $tc = array_search($tl, self::TEAM_LABELS);
                $tEmps = $employees->filter(fn($e) => $e->TEAM == $tc);

                // Count votes only from confirmed scheduled employees
                $shiftVotes = [];
                foreach ($tEmps as $e) {
                    $eid = (string)(int)$e->EMPLOYID;
                    if (!isset($empShift[$eid])) continue;
                    if (!($empShift[$eid]['scheduled'] ?? false)) continue; // confirmed only
                    $sid = $empShift[$eid]['shift_id'] ?? 0;
                    if ($sid === 0) continue;
                    $shiftVotes[$sid] = ($shiftVotes[$sid] ?? 0) + 1;
                }
                if (empty($shiftVotes)) continue;
                arsort($shiftVotes);
                $majorityShiftId = (int)array_key_first($shiftVotes);
                if (!isset($shiftMap[$majorityShiftId])) continue;

                // Apply majority inference ONLY for restday shifts (11,12)
                // For work shifts, individual fallback records are more accurate
                // This ensures wrong_schedule/late counts match the employees() endpoint
                $majorityIsRestday = in_array($majorityShiftId, [11, 12], true);
                if (!$majorityIsRestday) continue; // skip majority inference for work shifts

                foreach ($tEmps as $e) {
                    $eid = (string)(int)$e->EMPLOYID;
                    // Keep confirmed scheduled employees
                    if (isset($empShift[$eid]) && ($empShift[$eid]['scheduled'] ?? false)) continue;
                    // For restday majority: override all unconfirmed (including fallback)
                    $empShift[$eid] = [
                        'type'      => $shiftMap[$majorityShiftId]['type'],
                        'late_after'=> $shiftMap[$majorityShiftId]['late_after'],
                        'shift_id'  => $majorityShiftId,
                        'scheduled' => false,
                    ];
                }
            }

            $dayData = ['date' => $dateStr, 'teams' => []];

            foreach (['A','B','C'] as $teamLabel) {
                $teamCode = array_search($teamLabel, self::TEAM_LABELS);
                $teamEmps = $employees->filter(fn($e) => $e->TEAM == $teamCode);

                // Determine rotation from scheduled employees
                $dayCount = 0; $nightCount = 0;
                foreach ($teamEmps as $emp) {
                    $eid = (string)(int)$emp->EMPLOYID;
                    if (!isset($empShift[$eid])) continue;
                    if ($empShift[$eid]['type'] === 'day') $dayCount++;
                    else                                   $nightCount++;
                }
                $teamRotation = $dayCount >= $nightCount ? 'day' : 'night';

                // HC = employees with a work_scheduler record (sched_hc + restday_hc will sum to total scheduled)
                // Compute after processing loop; start with 0
                $stats = [
                    'team'              => $teamLabel,
                    'headcount'         => 0, // will be computed as sched_hc + unsched_hc
                    'sched_hc'          => 0,
                    'sched_present'     => 0,
                    'sched_absent'      => 0,
                    'sched_leave'       => 0,
                    'sched_late'        => 0,
                    'sched_wrong'       => 0,
                    'restday_hc'        => 0,
                    'restday_present'   => 0,
                    'unsched_hc'        => 0,
                    'unsched_present'   => 0,
                    'day_hc'            => 0,
                    'day_present'       => 0,
                    'day_absent'        => 0,
                    'day_late'          => 0,
                    // Night shift
                    'night_hc'          => 0,
                    'night_present'     => 0,
                    'night_absent'      => 0,
                    'night_late'        => 0,
                    // Totals
                    'present'           => 0,
                    'absent'            => 0,
                    'on_leave'          => 0,
                    'late'              => 0,
                    'att_rate'          => 0,
                ];

                foreach ($teamEmps as $emp) {
                    $eid       = (string)(int)$emp->EMPLOYID;
                    $shiftInfo = $empShift[$eid] ?? null;
                    $presKey   = "$eid|$dateStr";
                    $checkIn   = $checkInMap[$presKey] ?? null;
                    $isPresent = $checkIn !== null;
                    $isLeave   = isset($leaveSet[$presKey]);

                    if ($shiftInfo !== null) {
                        $shift       = $shiftInfo['type'];
                        $isScheduled = $shiftInfo['scheduled'] ?? false;
                        $shiftId2    = (int)($shiftInfo['shift_id'] ?? 0);
                        // Scheduled OT (9,10) only counts as restday if the
                        // employee did NOT check in — see isEffectiveRestday().
                        $isRestday   = $this->isEffectiveRestday($shiftId2, $isPresent);

                        if ($isRestday) {
                            // ── Rest Day (11,12 always; 9,10 when no check-in) ──
                            $stats['restday_hc']++;
                            if ($isPresent) {
                                $stats['present']++;
                                $stats['restday_present']++;
                                // Check wrong schedule for restday employees who check in
                                $punctuality = $this->classifyPunctuality($shiftId2, $checkIn);
                                if ($punctuality === 'wrong_schedule') {
                                    $stats['sched_wrong']++;
                                }
                            } elseif ($isLeave) {
                                $stats['on_leave']++;
                            }
                            // restday absent not counted
                        } elseif ($this->isWorkShift($shiftId2)) {
                            // ── Work shift ──
                            $stats['sched_hc']++;
                            if ($shift === 'day') $stats['day_hc']++;
                            else                  $stats['night_hc']++;

                            if ($isPresent) {
                                $stats['present']++;
                                $stats['sched_present']++;
                                if ($shift === 'day') $stats['day_present']++;
                                else                  $stats['night_present']++;

                                // Wrong Schedule & Late detection
                                if ($checkIn) {
                                    $punctuality = $this->classifyPunctuality($shiftId2, $checkIn);
                                    if ($punctuality === 'wrong_schedule') {
                                        $stats['sched_wrong']++;
                                    } elseif ($punctuality === 'late') {
                                        $stats['late']++; $stats['sched_late']++;
                                        if ($shift==='day') $stats['day_late']++; else $stats['night_late']++;
                                    }
                                }
                            } elseif ($isLeave) {
                                $stats['on_leave']++;
                                $stats['sched_leave']++;
                            } else {
                                // Skip night shift absent only if today AND shift not ended (before 07:00)
                                if ($isToday && $shift === 'night') continue; // night shift: never absent on shift date
                                $stats['absent']++;
                                $stats['sched_absent']++;
                                if ($shift === 'day') $stats['day_absent']++;
                                else                  $stats['night_absent']++;
                            }
                        } else {
                            // ── Shift ID outside WORK_SHIFT_IDS / RESTDAY_SHIFT_IDS
                            //    (e.g. 17, 18). No rule defined yet — preserve prior
                            //    behavior (counted as regular work, no wrong-schedule
                            //    detection) so employees don't silently vanish from
                            //    the report. Flag to product owner if these need
                            //    their own rule. ──────────────────────────────────
                            $stats['sched_hc']++;
                            if ($shift === 'day') $stats['day_hc']++;
                            else                  $stats['night_hc']++;

                            if ($isPresent) {
                                $stats['present']++;
                                $stats['sched_present']++;
                                if ($shift === 'day') $stats['day_present']++;
                                else                  $stats['night_present']++;
                            } elseif ($isLeave) {
                                $stats['on_leave']++;
                                $stats['sched_leave']++;
                            } else {
                                if ($isToday && $shift === 'night') continue; // night shift: never absent on shift date
                                $stats['absent']++;
                                $stats['sched_absent']++;
                                if ($shift === 'day') $stats['day_absent']++;
                                else                  $stats['night_absent']++;
                            }
                        }
                    } else {
                        // ── Unscheduled employee — cover-up worker ────────
                        $stats['unsched_hc']++;
                        if ($isPresent) {
                            $stats['present']++;
                            $stats['unsched_present']++;
                            // Count present toward team rotation shift
                            if ($teamRotation === 'day') $stats['day_present']++;
                            else                         $stats['night_present']++;
                        } elseif ($isLeave) {
                            $stats['on_leave']++;
                        }
                        // unsched HC does NOT add to day_hc/night_hc (not in denominator)
                    }
                }
                // HC = scheduled (regular) + unscheduled only — restday is separate
                $stats['headcount'] = $stats['sched_hc'] + $stats['unsched_hc'];

                // Att rate: present / sched_hc (day + night scheduled employees)
                // day_present and night_present include unsched cover-up workers
                $daySchedHC   = $stats['day_hc'];
                $nightSchedHC = $stats['night_hc'];
                $schedHC      = $daySchedHC + $nightSchedHC;
                $totalPresent = $stats['day_present'] + $stats['night_present'];

                $stats['att_rate']       = $schedHC > 0
                    ? round($totalPresent / $schedHC * 100, 1) : 0;
                $stats['day_att_rate']   = $daySchedHC > 0
                    ? round($stats['day_present'] / $daySchedHC * 100, 1) : 0;
                $stats['night_att_rate'] = $nightSchedHC > 0
                    ? round($stats['night_present'] / $nightSchedHC * 100, 1) : 0;

                $dayData['teams'][$teamLabel] = $stats;

                if (!isset($teamSummary[$teamLabel])) {
                    $teamSummary[$teamLabel] = [
                        'team'=>$teamLabel,
                        'headcount'=>0,'sched_hc'=>0,'unsched_hc'=>0,
                        'restday_hc'=>0,'restday_present'=>0,
                        'sched_present'=>0,'sched_absent'=>0,'sched_leave'=>0,'sched_late'=>0,'sched_wrong'=>0,
                        'unsched_present'=>0,
                        'day_hc'=>0,'day_present'=>0,'day_absent'=>0,'day_late'=>0,
                        'night_hc'=>0,'night_present'=>0,'night_absent'=>0,'night_late'=>0,
                        'present'=>0,'absent'=>0,'on_leave'=>0,'late'=>0,'days'=>0,
                    ];
                }
                foreach (['headcount','sched_hc','unsched_hc',
                          'restday_hc','restday_present',
                          'sched_present','sched_absent','sched_leave','sched_late','sched_wrong',
                          'unsched_present',
                          'day_hc','day_present','day_absent','day_late',
                          'night_hc','night_present','night_absent','night_late',
                          'present','absent','on_leave','late'] as $key) {
                    $teamSummary[$teamLabel][$key] += $stats[$key];
                }
                $teamSummary[$teamLabel]['days']++;
            }

            $byDay[] = $dayData;
        }

        foreach ($teamSummary as &$ts) {
            $daySchedHC   = $ts['day_hc'];
            $nightSchedHC = $ts['night_hc'];
            $schedHC      = $daySchedHC + $nightSchedHC;
            $numerator    = $ts['day_present'] + $ts['night_present'];
            $ts['avg_att_rate']       = $schedHC > 0
                ? round(($numerator / $schedHC) * 100, 1) : 0;
            $ts['avg_day_att_rate']   = $daySchedHC > 0
                ? round(($ts['day_present'] / $daySchedHC) * 100, 1) : 0;
            $ts['avg_night_att_rate'] = $nightSchedHC > 0
                ? round(($ts['night_present'] / $nightSchedHC) * 100, 1) : 0;
        }

        $lastDay = end($byDay);
        $totalHc = $lastDay
            ? collect($lastDay['teams'])->sum(fn($t) => $t['headcount'])
            : 0;

        return response()->json([
            'by_day'   => $byDay,
            'summary'  => array_values($teamSummary),
            'total_hc' => $totalHc,
        ]);
    }

    /* ── GET /api/attendance/employees ──────────────────────────── */
    public function employees(Request $request)
    {
        $date    = $request->get('date', now()->toDateString());
        $factory = $request->get('factory', null);
        $team    = $request->get('team', null);
        $status  = $request->get('status', null);

        $shiftMap = $this->loadShiftMap();

        $empQuery = DB::connection('masterlist')
            ->table('employee_masterlist')
            ->where('ACCSTATUS', '1')
            ->whereIn('TEAM', ['2', '3', '4'])
            ->select('EMPID','EMPLOYID','TEAM','Factory','PRODLINE','EMPNAME',
                     DB::raw("CONCAT(IFNULL(FIRSTNAME,''),' ',IFNULL(LASTNAME,'')) as full_name"));

        if ($factory && $factory !== 'All') {
            $empQuery->where('Factory', $factory);
        }
        if ($team) {
            $teamCode = array_search($team, self::TEAM_LABELS);
            if ($teamCode) $empQuery->where('TEAM', $teamCode);
        }

        $employees  = $empQuery->get();
        $employids  = $employees->pluck('EMPLOYID')->map(fn($e) => (string)(int)$e)->toArray();
        $eidList    = "'".implode("','", $employids)."'";
        // work_scheduler.EMPID stores EMPLOYID (biometric ID)
        $empByEmployid2 = $employees->keyBy(fn($e) => (string)(int)$e->EMPLOYID);

        $logsManual = DB::connection('qdn_db')->select(
            "SELECT employid, MIN(TIME(datetime)) as first_checkin
             FROM dtr.biometric_logs_manual
             WHERE punch_type='check_in' AND DATE(datetime)=?
             AND employid IN ($eidList) GROUP BY employid", [$date]);

        $logsBio = DB::connection('qdn_db')->select(
            "SELECT employid, MIN(TIME(datetime)) as first_checkin
             FROM dtr.biometric_logs
             WHERE punch_type='check_in' AND DATE(datetime)=?
             AND employid IN ($eidList) GROUP BY employid", [$date]);

        $checkInMap = [];
        foreach (array_merge($logsManual, $logsBio) as $log) {
            $key = (string)(int)$log->employid;
            if (!isset($checkInMap[$key]) || $log->first_checkin < $checkInMap[$key]) {
                $checkInMap[$key] = $log->first_checkin;
            }
        }

        $leaves = DB::connection('masterlist')->select(
            "SELECT EMPLOYID FROM leavesys_new_db.employee_leaves
             WHERE LEAVESTATUS='APPROVED' AND DATESTART<=? AND DATEEND>=?
             AND EMPLOYID IN ($eidList)", [$date, $date]);
        $leaveSet = collect($leaves)->pluck('EMPLOYID')
            ->map(fn($e) => (string)(int)$e)->flip()->toArray();

        $schedulers = DB::connection('scheduler')->table('work_scheduler')
            ->where('PAYROLL_DATE_START','<=',$date)
            ->where('PAYROLL_DATE_END','>=',$date)
            ->whereIn('WORK_SCHED_STATUS', [1, 2, 3])
            ->whereIn('EMPID', array_map('intval', $employids))
            ->select('EMPID','SCHEDULE','PAYROLL_DATE_START','PAYROLL_DATE_END')
            ->orderBy('ID', 'desc')
            ->get()
            ->unique('EMPID'); // keep latest (highest ID) per EMPID

        // Fallback: most recent schedule for employees with no current period record
        $coveredEids2 = $schedulers->pluck('EMPID')->map(fn($e)=>(string)(int)$e)->unique()->toArray();
        $uncoveredEids2 = array_values(array_diff($employids, $coveredEids2));
        $fallbackSchedulers = collect();
        if (!empty($uncoveredEids2)) {
            $inList2 = implode(',', array_map('intval', $uncoveredEids2));
            $fallbackSchedulers = collect(DB::connection('scheduler')->select(
                "SELECT ws.EMPID, ws.SCHEDULE, ws.PAYROLL_DATE_START, ws.PAYROLL_DATE_END
                 FROM hr_calendar.work_scheduler ws
                 INNER JOIN (
                     SELECT EMPID, MAX(PAYROLL_DATE_END) as max_end
                     FROM hr_calendar.work_scheduler
                     WHERE EMPID IN ($inList2)
                     AND WORK_SCHED_STATUS IN (1,2,3)
                     GROUP BY EMPID
                 ) latest ON ws.EMPID = latest.EMPID
                         AND ws.PAYROLL_DATE_END = latest.max_end
                 WHERE ws.WORK_SCHED_STATUS IN (1,2,3)"
            ));
        }

        $empShift = [];
        // First pass: current period
        foreach ($schedulers as $s) {
            $periodStart = Carbon::parse($s->PAYROLL_DATE_START);
            $schedule    = json_decode($s->SCHEDULE, true);
            if (!$schedule) continue;
            $dayOfPeriod = (string)($periodStart->diffInDays($date) + 1);
            if (!isset($schedule[$dayOfPeriod])) continue;
            $shiftId = (int)$schedule[$dayOfPeriod];
            if (!isset($shiftMap[$shiftId])) continue;
            $emp = $empByEmployid2[(string)$s->EMPID] ?? null;
            if (!$emp) continue;
            $isDay = $shiftMap[$shiftId]['type'] === 'day';
            $empShift[(string)(int)$emp->EMPLOYID] = [
                'type'        => $isDay ? 'day' : 'night',
                'late_after'  => $shiftMap[$shiftId]['late_after'],
                'shiftcode'   => $shiftMap[$shiftId]['shiftcode'],
                'desc'        => $shiftMap[$shiftId]['desc'] ?? '',
                'shift_id'    => $shiftId,
                'scheduled'   => true,
            ];
        }
        // Second pass: fallback using current period start as reference
        foreach ($fallbackSchedulers as $s) {
            $emp = $empByEmployid2[(string)$s->EMPID] ?? null;
            if (!$emp) continue;
            $employid = (string)(int)$emp->EMPLOYID;
            if (isset($empShift[$employid])) continue;
            $schedule = json_decode($s->SCHEDULE, true);
            if (!$schedule) continue;
            $periodStart  = Carbon::parse($s->PAYROLL_DATE_START);
            $periodLength = count($schedule);
            if ($periodLength === 0) continue;
            // Use current period start as reference (same as summary refStart fix)
            $refStart = null;
            foreach ($schedulers as $cs) {
                $cps = Carbon::parse($cs->PAYROLL_DATE_START);
                $cpe = Carbon::parse($cs->PAYROLL_DATE_END);
                if (Carbon::parse($date)->gte($cps) && Carbon::parse($date)->lte($cpe)) {
                    $refStart = $cps;
                    break;
                }
            }
            if (!$refStart) $refStart = $periodStart;
            $dayOfPeriod  = (string)(($refStart->diffInDays($date) % $periodLength) + 1);
            if (!isset($schedule[$dayOfPeriod])) $dayOfPeriod = '1';
            if (!isset($schedule[$dayOfPeriod])) continue;
            $shiftId = (int)$schedule[$dayOfPeriod];
            if ($shiftId === 0 || !isset($shiftMap[$shiftId])) continue;
            $isDay = $shiftMap[$shiftId]['type'] === 'day';
            $empShift[$employid] = [
                'type'        => $isDay ? 'day' : 'night',
                'late_after'  => $shiftMap[$shiftId]['late_after'],
                'shiftcode'   => $shiftMap[$shiftId]['shiftcode'],
                'desc'        => $shiftMap[$shiftId]['desc'] ?? '',
                'shift_id'    => $shiftId,
                'scheduled'   => false,
            ];
        }

        $isToday = $date === now()->toDateString();
        $result  = $employees->map(function($emp) use ($checkInMap, $leaveSet, $empShift, $isToday) {
            $eid       = (string)(int)$emp->EMPLOYID;
            $checkIn   = $checkInMap[$eid] ?? null;
            $isLeave   = isset($leaveSet[$eid]);
            $shift     = $empShift[$eid] ?? null;
            $teamLabel = self::TEAM_LABELS[$emp->TEAM] ?? '?';

            $shiftId2    = (int)($shift['shift_id'] ?? 0);
            // Scheduled OT (9,10) only counts as restday if no check-in.
            $isRestday   = $shift && $this->isEffectiveRestday($shiftId2, $checkIn !== null);
            $isNight     = $shift && $shift['type'] === 'night';
            $isNightById = in_array($shiftId2, self::NIGHT_TYPE_SHIFT_IDS, true);

            // Wrong Schedule / Late — confirmed rules:
            // Day shift (15,9,21):   check-in <= 07:00 = on time
            //                        07:01 - 18:59      = Late
            //                        >= 19:00            = Wrong Schedule
            // Night shift (16,10,22): check-in <= 07:00 = Wrong Schedule
            //                         07:01 - 19:00       = on time
            //                         >= 19:01             = Late
            $isWrongShift = false;
            $isLate       = false;
            if ($checkIn && $shift) {
                $punctuality  = $this->classifyPunctuality($shiftId2, $checkIn);
                $isWrongShift = $punctuality === 'wrong_schedule';
                if (!$isRestday) {
                    $isLate = $punctuality === 'late';
                }
            }

            if ($checkIn)                               $empStatus = 'present';
            elseif ($isLeave)                           $empStatus = 'leave';
            elseif ($isRestday)                         $empStatus = 'restday';
            elseif ($isToday && ($isNight || $isNightById)) $empStatus = 'pending'; // night shift always pending on shift date
            else                                        $empStatus = 'absent';

            return [
                'employid'    => $emp->EMPLOYID,
                'name'        => trim($emp->full_name) ?: ($emp->EMPNAME ?: 'EMP-'.$emp->EMPLOYID),
                'team'        => $teamLabel,
                'factory'     => $emp->Factory ?: '—',
                'prodline'    => $emp->PRODLINE ?: '—',
                'shift'       => $shift ? $shift['shiftcode'] : '—',
                'shift_desc'  => $shift ? ($shift['desc'] ?? '') : '',
                'shift_type'  => $shift ? $shift['type'] : null,
                'shift_id'    => $shift ? ($shift['shift_id'] ?? null) : null,
                'scheduled'   => $shift !== null && ($shift['scheduled'] ?? false) === true,
                'restday'     => $isRestday,
                'check_in'    => $checkIn,
                'status'      => $empStatus,
                'late'        => $isLate,
                'wrong_shift' => $isWrongShift,
            ];
        });

        if ($status) {
            $result = $result->filter(function($r) use ($status) {
                if ($status === 'late')            return $r['late'];
                if ($status === 'wrong_schedule')  return $r['wrong_shift'];
                if ($status === 'no_schedule')     return !$r['scheduled'];
                if ($status === 'scheduled')       return $r['scheduled'] && !$r['restday'];
                if ($status === 'restday')         return $r['restday'];
                return $r['status'] === $status;
            });
        }

        return response()->json($result->values());
    }

    /* ── GET /api/attendance/breakdown-employees ────────────────── */
    public function breakdownEmployees(Request $request)
    {
        $date       = $request->get('date', now()->toDateString());
        $factory    = $request->get('factory', null);
        $department = $request->get('department', null);
        $row_label  = $request->get('row_label', null);
        $row_type   = $request->get('row_type', null);  // job_title|station
        $status     = $request->get('status', null);    // present|absent|all

        $empQuery = DB::connection('masterlist')
            ->table('employee_masterlist')
            ->whereIn('TEAM', ['2', '3', '4'])
            ->where('ACCSTATUS', '1')
            ->select('EMPLOYID','EMPNAME','TEAM','Factory',
                     'DEPARTMENT','JOB_TITLE','STATION','CERTIFICATION_STATUS');

        if ($factory && $factory !== 'All') {
            $empQuery->where('Factory', $factory);
        }

        // Filter by department
        $DEPT_MAP = [
            'PPC'                   => ['PPC'],
            'Production'            => ['Production','Production / Non - TNR','Production - QFP','Production - RFC'],
            'Equipment Engineering' => ['Equipment Engineering'],
            'Quality Assurance'     => ['Quality Assurance'],
            'Process Engineering'   => ['Process Engineering'],
        ];

        if ($department && isset($DEPT_MAP[$department])) {
            $empQuery->whereIn('DEPARTMENT', $DEPT_MAP[$department]);
        }

        $employees = $empQuery->get();

        $ROW_MATCHES = [
            'Section Head'         => ['job_title', ['Section Head','Section Manager']],
            'Supervisor/ Engineer' => ['job_title', ['Supervisor','Engineer','Planner','PPC Engineer']],
            'Wip Controller'       => ['job_title', ['Wip Controller','WIP Controller','Wip Updater']],
            'Rescon'               => ['station',   ['Rescon']],
            'Bake'                 => ['station',   ['Bake','Oven']],
            'Brand'                => ['station',   ['Brand']],
            'TnR'                  => ['station',   ['TnR','TnR - MH']],
            'TRS'                  => ['station',   ['TRS']],
            'FVI'                  => ['station',   ['FVI']],
            'Special Activity'     => ['station',   ['Special Activities','Special Activity']],
            'MH'                   => ['job_title', ['Material Handler']],
            'Boxing'               => ['station',   ['Boxing']],
            'Line Sustaining'      => ['station',   ['Standard-Gravity','Tray / Turret','Tray/Turret']],
            'PM / Calibration'     => ['station',   ['PM / Calibration']],
            'Batching'             => ['station',   ['Batching','IQA']],
            'IQA/OQA'              => ['station',   ['IQA/OQA','IQA / OQA','OQA','OQA Mainstream','OQA - Mainstream']],
            'Reject Control'       => ['station',   ['Reject']],
            'Process Technician'   => ['job_title', ['Process Technician','Process Tech','Senior Process']],
        ];

        if ($row_label) {
            if (isset($ROW_MATCHES[$row_label])) {
                [$matchType, $matchPatterns] = $ROW_MATCHES[$row_label];
                $employees = $employees->filter(function($e) use ($matchType, $matchPatterns) {
                    $field = $matchType === 'station' ? ($e->STATION ?? '') : ($e->JOB_TITLE ?? '');
                    foreach ($matchPatterns as $pattern) {
                        if (stripos($field, $pattern) !== false) return true;
                    }
                    return false;
                });
            } elseif ($row_type) {
                $employees = $employees->filter(function($e) use ($row_label, $row_type) {
                    $field = $row_type === 'station' ? ($e->STATION ?? '') : ($e->JOB_TITLE ?? '');
                    return stripos($field, $row_label) !== false;
                });
            }
        }

        $employids = $employees->pluck('EMPLOYID')->map(fn($e) => (string)(int)$e)->toArray();
        if (empty($employids)) return response()->json([]);

        // Separate section heads (vp_logs only) from regular employees (biometric_logs)
        $sectionHeadIds = $employees->filter(fn($e) =>
            stripos($e->JOB_TITLE ?? '', 'Section Head') !== false ||
            stripos($e->JOB_TITLE ?? '', 'Section Manager') !== false
        )->pluck('EMPLOYID')->map(fn($e) => (string)(int)$e)->toArray();

        $regularIds = array_values(array_diff($employids, $sectionHeadIds));
        $checkInMap = [];

        // Regular employees: biometric_logs + biometric_logs_manual
        if (!empty($regularIds)) {
            $rList   = "'".implode("','", $regularIds)."'";
            $logsBio = DB::connection('qdn_db')->select(
                "SELECT employid, MIN(TIME(datetime)) as first_checkin
                 FROM dtr.biometric_logs
                 WHERE punch_type='check_in' AND DATE(datetime)=?
                 AND employid IN ($rList) GROUP BY employid", [$date]);
            $logsMan = DB::connection('qdn_db')->select(
                "SELECT employid, MIN(TIME(datetime)) as first_checkin
                 FROM dtr.biometric_logs_manual
                 WHERE punch_type='check_in' AND DATE(datetime)=?
                 AND employid IN ($rList) GROUP BY employid", [$date]);
            foreach (array_merge($logsBio, $logsMan) as $log) {
                $key = (string)(int)$log->employid;
                if (!isset($checkInMap[$key]) || $log->first_checkin < $checkInMap[$key]) {
                    $checkInMap[$key] = $log->first_checkin;
                }
            }
        }

        // Section Heads: vp_logs ONLY
        if (!empty($sectionHeadIds)) {
            $vpList = "'".implode("','", $sectionHeadIds)."'";
            $vpLogs = DB::connection('qdn_db')->select(
                "SELECT employee_id, MIN(log_time) as first_checkin
                 FROM dtr.vp_logs
                 WHERE log_date=? AND employee_id IN ($vpList)
                 GROUP BY employee_id", [$date]);
            foreach ($vpLogs as $vp) {
                $key = (string)(int)$vp->employee_id;
                if (!isset($checkInMap[$key]) || $vp->first_checkin < $checkInMap[$key]) {
                    $checkInMap[$key] = $vp->first_checkin;
                }
            }
        }

        // Build empShift for restday and night detection
        $isToday    = $date === now()->toDateString();
        $shiftMap   = $this->loadShiftMap();
        $allEids    = $employees->pluck('EMPLOYID')->map(fn($e) => (int)$e)->toArray();
        $empByEid   = $employees->keyBy(fn($e) => (string)(int)$e->EMPLOYID);
        $schedulers = DB::connection('scheduler')->table('work_scheduler')
            ->where('PAYROLL_DATE_START', '<=', $date)
            ->where('PAYROLL_DATE_END',   '>=', $date)
            ->whereIn('WORK_SCHED_STATUS', [1, 2, 3])
            ->whereIn('EMPID', $allEids)
            ->select('EMPID','SCHEDULE','PAYROLL_DATE_START')
            ->orderBy('ID', 'desc')
            ->get()->unique('EMPID');

        $empShift = [];
        foreach ($schedulers as $s) {
            $periodStart = \Carbon\Carbon::parse($s->PAYROLL_DATE_START);
            $schedule    = json_decode($s->SCHEDULE, true);
            if (!$schedule) continue;
            $dayOfPeriod = (string)($periodStart->diffInDays($date) + 1);
            if (!isset($schedule[$dayOfPeriod])) continue;
            $shiftId = (int)$schedule[$dayOfPeriod];
            if (!isset($shiftMap[$shiftId])) continue;
            $emp = $empByEid[(string)$s->EMPID] ?? null;
            if (!$emp) continue;
            $empShift[(string)(int)$emp->EMPLOYID] = [
                'type'      => $shiftMap[$shiftId]['type'],
                'shift_id'  => $shiftId,
                'shiftcode' => $shiftMap[$shiftId]['shiftcode'] ?? '—',
            ];
        }

        $result = $employees->map(function($emp) use ($checkInMap, $empShift, $isToday) {
            $eid       = (string)(int)$emp->EMPLOYID;
            $checkIn   = $checkInMap[$eid] ?? null;
            $certStatus = $emp->CERTIFICATION_STATUS ?? '—';
            $isTrain   = in_array($certStatus, ['BUDDY', 'CLASSROOM']);
            $category  = $isTrain ? 'Trainee (' . $certStatus . ')' : 'Certified';
            $shift     = $empShift[$eid] ?? null;
            // Scheduled OT (9,10) only counts as restday if no check-in.
            $isRestday = $shift && $this->isEffectiveRestday((int)($shift['shift_id'] ?? 0), $checkIn !== null);
            $isNight   = $shift && $shift['type'] === 'night';

            $shiftId2    = (int)($shift['shift_id'] ?? 0);
            $isWrongShift = false;
            $isLate       = false;
            if ($checkIn && $shift) {
                if ($isRestday) {
                    $isWrongShift = true;
                } else {
                    $punctuality  = $this->classifyPunctuality($shiftId2, $checkIn);
                    $isWrongShift = $punctuality === 'wrong_schedule';
                    $isLate       = $punctuality === 'late';
                }
            }
            // Determine status
            if ($checkIn) {
                $status = 'present';
            } elseif ($isRestday) {
                $status = 'restday';
            } elseif ($isToday && $isNight) {
                $status = 'pending'; // night shift always pending on shift date
            } else {
                $status = 'absent';
            }

            return [
                'employid'   => $emp->EMPLOYID,
                'name'       => $emp->EMPNAME,
                'department' => $emp->DEPARTMENT,
                'job_title'  => $emp->JOB_TITLE,
                'station'    => $emp->STATION,
                'category'   => $category,
                'shift'      => $shift ? ($shift['shiftcode'] ?? '—') : '—',
                'shift_type' => $shift ? $shift['type'] : null,
                'shift_id'   => (int)($shift['shift_id'] ?? 0) ?: null,
                'check_in'   => $checkIn,
                'status'     => $status,
                'restday'    => $isRestday,
                'wrong_shift' => $isWrongShift,
                'late'        => $isLate,
            ];
        });

        if ($status && $status !== 'all') {
            $result = $result->filter(fn($r) => $r['status'] === $status);
        } else {
            // 'all' still excludes restday and pending (on-shift) — match tallyRow logic
            $result = $result->filter(fn($r) => !in_array($r['status'], ['restday', 'pending']));
        }

        return response()->json($result->values());
    }

    public function dates()
    {
        $dates = DB::connection('qdn_db')->select(
            "SELECT DISTINCT DATE(datetime) as date
             FROM dtr.biometric_logs WHERE punch_type='check_in'
             ORDER BY date DESC LIMIT 60"
        );
        return response()->json(array_map(fn($r) => $r->date, $dates));
    }

    /* ── GET /api/attendance/breakdown ─────────────────────────────── */
    public function breakdown(Request $request)
    {
        set_time_limit(180);

        $date    = $request->get('date', now()->toDateString());
        $factory = $request->get('factory', null);

        $empQuery = DB::connection('masterlist')
            ->table('employee_masterlist')
            ->whereIn('TEAM', ['2', '3', '4'])
            ->where('ACCSTATUS', '1')
            ->select('EMPLOYID','EMPNAME','TEAM','Factory',
                     'DEPARTMENT','JOB_TITLE','STATION','CERTIFICATION_STATUS');

        if ($factory && $factory !== 'All') {
            $empQuery->where('Factory', $factory);
        }

        $employees = $empQuery->get();
        $employids = $employees->pluck('EMPLOYID')->map(fn($e) => (string)(int)$e)->toArray();

        if (empty($employids)) return response()->json(['rows' => []]);

        // Separate section heads (vp_logs only) from regular employees (biometric_logs)
        $sectionHeadIds = $employees->filter(fn($e) =>
            stripos($e->JOB_TITLE ?? '', 'Section Head') !== false ||
            stripos($e->JOB_TITLE ?? '', 'Section Manager') !== false
        )->pluck('EMPLOYID')->map(fn($e) => (string)(int)$e)->toArray();

        $regularIds = array_values(array_diff($employids, $sectionHeadIds));
        $checkedIn  = [];

        // Regular employees: biometric_logs + biometric_logs_manual
        if (!empty($regularIds)) {
            $rList   = "'".implode("','", $regularIds)."'";
            $logsBio = DB::connection('qdn_db')->select(
                "SELECT employid FROM dtr.biometric_logs
                 WHERE punch_type='check_in' AND DATE(datetime)=?
                 AND employid IN ($rList) GROUP BY employid", [$date]);
            $logsMan = DB::connection('qdn_db')->select(
                "SELECT employid FROM dtr.biometric_logs_manual
                 WHERE punch_type='check_in' AND DATE(datetime)=?
                 AND employid IN ($rList) GROUP BY employid", [$date]);
            foreach (array_merge($logsBio, $logsMan) as $log) {
                $checkedIn[(string)(int)$log->employid] = true;
            }
        }

        // Section Heads: vp_logs ONLY
        if (!empty($sectionHeadIds)) {
            $vpList = "'".implode("','", $sectionHeadIds)."'";
            $vpLogs = DB::connection('qdn_db')->select(
                "SELECT employee_id FROM dtr.vp_logs
                 WHERE log_date=? AND employee_id IN ($vpList)
                 GROUP BY employee_id", [$date]);
            foreach ($vpLogs as $vp) {
                $checkedIn[(string)(int)$vp->employee_id] = true;
            }
        }

        $isToday  = $date === now()->toDateString();
        $shiftMap = $this->loadShiftMap();

        // Build empShift for night shift detection
        $empids     = $employees->pluck('EMPLOYID')->map(fn($e) => (int)$e)->toArray();
        $empByEmployid = $employees->keyBy(fn($e) => (string)(int)$e->EMPLOYID);
        $schedulers = DB::connection('scheduler')->table('work_scheduler')
            ->where('PAYROLL_DATE_START', '<=', $date)
            ->where('PAYROLL_DATE_END',   '>=', $date)
            ->whereIn('WORK_SCHED_STATUS', [1, 2, 3])
            ->whereIn('EMPID', $empids)
            ->select('EMPID','SCHEDULE','PAYROLL_DATE_START','PAYROLL_DATE_END')
            ->orderBy('ID', 'desc')
            ->get()->unique('EMPID');

        // Fallback for employees with no current period record
        $coveredBD = $schedulers->pluck('EMPID')->map(fn($e)=>(string)(int)$e)->unique()->toArray();
        $uncoveredBD = array_values(array_diff(array_map('strval',$empids), $coveredBD));
        $fallbackBD = collect();
        if (!empty($uncoveredBD)) {
            $inListBD = implode(',', array_map('intval', $uncoveredBD));
            $fallbackBD = collect(DB::connection('scheduler')->select(
                "SELECT ws.EMPID, ws.SCHEDULE, ws.PAYROLL_DATE_START, ws.PAYROLL_DATE_END
                 FROM hr_calendar.work_scheduler ws
                 INNER JOIN (
                     SELECT EMPID, MAX(PAYROLL_DATE_END) as max_end
                     FROM hr_calendar.work_scheduler
                     WHERE EMPID IN ($inListBD)
                     AND WORK_SCHED_STATUS IN (1,2,3)
                     GROUP BY EMPID
                 ) latest ON ws.EMPID = latest.EMPID
                         AND ws.PAYROLL_DATE_END = latest.max_end
                 WHERE ws.WORK_SCHED_STATUS IN (1,2,3)"
            ));
        }

        $empShift = [];
        foreach ($schedulers as $s) {
            $periodStart = \Carbon\Carbon::parse($s->PAYROLL_DATE_START);
            $schedule    = json_decode($s->SCHEDULE, true);
            if (!$schedule) continue;
            $dayOfPeriod = (string)($periodStart->diffInDays($date) + 1);
            if (!isset($schedule[$dayOfPeriod])) continue;
            $shiftId = (int)$schedule[$dayOfPeriod];
            if (!isset($shiftMap[$shiftId])) continue;
            $emp = $empByEmployid[(string)$s->EMPID] ?? null;
            if (!$emp) continue;
            $empShift[(string)(int)$emp->EMPLOYID] = [
                'type'      => $shiftMap[$shiftId]['type'],
                'shift_id'  => $shiftId,
                'shiftcode' => $shiftMap[$shiftId]['shiftcode'] ?? '—',
                'scheduled' => true,
            ];
        }

        // Fallback pass — use current period start as reference
        foreach ($fallbackBD as $s) {
            $emp = $empByEmployid[(string)$s->EMPID] ?? null;
            if (!$emp) continue;
            $employid = (string)(int)$emp->EMPLOYID;
            if (isset($empShift[$employid])) continue;
            $schedule = json_decode($s->SCHEDULE, true);
            if (!$schedule) continue;
            $periodStart  = \Carbon\Carbon::parse($s->PAYROLL_DATE_START);
            $periodLength = count($schedule);
            if ($periodLength === 0) continue;
            $refStart = null;
            foreach ($schedulers as $cs) {
                $cps = \Carbon\Carbon::parse($cs->PAYROLL_DATE_START);
                $cpe = \Carbon\Carbon::parse($cs->PAYROLL_DATE_END);
                if (\Carbon\Carbon::parse($date)->gte($cps) && \Carbon\Carbon::parse($date)->lte($cpe)) {
                    $refStart = $cps; break;
                }
            }
            if (!$refStart) $refStart = $periodStart;
            $dayOfPeriod = (string)(($refStart->diffInDays($date) % $periodLength) + 1);
            if (!isset($schedule[$dayOfPeriod])) $dayOfPeriod = '1';
            if (!isset($schedule[$dayOfPeriod])) continue;
            $shiftId = (int)$schedule[$dayOfPeriod];
            if ($shiftId === 0 || !isset($shiftMap[$shiftId])) continue;
            $empShift[$employid] = [
                'type'      => $shiftMap[$shiftId]['type'],
                'shift_id'  => $shiftId,
                'shiftcode' => $shiftMap[$shiftId]['shiftcode'] ?? '—',
                'scheduled' => false,
            ];
        }

        $DEPT_MAP = [
            'PPC'                   => ['PPC'],
            'Production'            => ['Production','Production / Non - TNR','Production - QFP','Production - RFC'],
            'Equipment Engineering' => ['Equipment Engineering'],
            'Quality Assurance'     => ['Quality Assurance'],
            'Process Engineering'   => ['Process Engineering'],
        ];

        $ROWS = [
            'PPC' => [
                ['label'=>'Section Head',         'type'=>'job_title', 'match'=>['Section Head','Section Manager']],
                ['label'=>'Supervisor/ Engineer',  'type'=>'job_title', 'match'=>['Supervisor','PPC Engineer','Planner']],
                ['label'=>'Wip Controller',        'type'=>'job_title', 'match'=>['Wip Controller','WIP Controller','Wip Updater']],
                ['label'=>'Rescon',                'type'=>'station',   'match'=>['Rescon']],
            ],
            'Production' => [
                ['label'=>'Section Head',          'type'=>'job_title', 'match'=>['Section Head','Section Manager']],
                ['label'=>'Supervisor/ Engineer',  'type'=>'job_title', 'match'=>['Supervisor','Engineer']],
                ['label'=>'Bake',                  'type'=>'station',   'match'=>['Bake','Oven']],
                ['label'=>'Brand',                 'type'=>'station',   'match'=>['Brand']],
                ['label'=>'TnR',                   'type'=>'station',   'match'=>['TnR','TnR - MH']],
                ['label'=>'TRS',                   'type'=>'station',   'match'=>['TRS']],
                ['label'=>'FVI',                   'type'=>'station',   'match'=>['FVI']],
                ['label'=>'Special Activity',      'type'=>'station',   'match'=>['Special Activities','Special Activity']],
                ['label'=>'MH',                    'type'=>'job_title', 'match'=>['Material Handler']],
                ['label'=>'Boxing',                'type'=>'station',   'match'=>['Boxing']],
            ],
            'Equipment Engineering' => [
                ['label'=>'Section Head',          'type'=>'job_title', 'match'=>['Section Head','Section Manager']],
                ['label'=>'Supervisor/ Engineer',  'type'=>'job_title', 'match'=>['Supervisor','Engineer']],
                ['label'=>'Line Sustaining',       'type'=>'station',   'match'=>['Standard-Gravity','Tray / Turret','Tray/Turret']],
                ['label'=>'Brand',                 'type'=>'station',   'match'=>['Brand']],
                ['label'=>'PM / Calibration',      'type'=>'station',   'match'=>['PM / Calibration']],
            ],
            'Quality Assurance' => [
                ['label'=>'Supervisor/ Engineer',  'type'=>'job_title', 'match'=>['Supervisor','Engineer']],
                ['label'=>'Batching',              'type'=>'station',   'match'=>['Batching']],
                ['label'=>'IQA/OQA',               'type'=>'station',   'match'=>['IQA/OQA','IQA / OQA','OQA Mainstream','OQA - Mainstream']],
                ['label'=>'Brand',                 'type'=>'station',   'match'=>['Brand']],
                ['label'=>'Reject Control',        'type'=>'station',   'match'=>['Reject']],
            ],
            'Process Engineering' => [
                ['label'=>'Supervisor/ Engineer',  'type'=>'job_title', 'match'=>['Supervisor','Engineer']],
                ['label'=>'Process Technician',    'type'=>'job_title', 'match'=>['Process Technician','Process Tech','Senior Process']],
            ],
        ];

        $result = [];

        foreach ($DEPT_MAP as $deptLabel => $deptNames) {
            $deptEmps    = $employees->filter(fn($e) => in_array($e->DEPARTMENT, $deptNames));
            $rowResults  = [];
            $matchedEids = collect();

            foreach ($ROWS[$deptLabel] as $rowDef) {
                $rowEmps = $deptEmps->filter(function($e) use ($rowDef) {
                    $field = $rowDef['type'] === 'station'
                        ? ($e->STATION   ?? '')
                        : ($e->JOB_TITLE ?? '');
                    foreach ($rowDef['match'] as $m) {
                        if (stripos($field, $m) !== false) return true;
                    }
                    return false;
                });
                $matchedEids = $matchedEids->merge($rowEmps->pluck('EMPLOYID'));
                $rowResults[] = $this->tallyRow($rowDef['label'], 'row', $rowEmps, $checkedIn, $empShift, $isToday, $rowDef['type']);
            }


            $deptRow = $this->sumRows($deptLabel, 'department', $rowResults);
            $result[] = $deptRow;
            foreach ($rowResults as $rr) {
                $result[] = $rr;
            }
        }

        // Grand total
        $allData = collect($result)->where('type', 'department')->pluck('data');
        $grand   = [
            'dl_sched'      => $allData->sum('dl_sched'),
            'train_sched'   => $allData->sum('train_sched'),
            'total_sched'   => $allData->sum('total_sched'),
            'dl_present'    => $allData->sum('dl_present'),
            'train_present' => $allData->sum('train_present'),
            'total_present' => $allData->sum('total_present'),
            'dl_absent'     => $allData->sum('dl_absent'),
            'train_absent'  => $allData->sum('train_absent'),
            'total_absent'  => $allData->sum('total_absent'),
        ];
        $grand['pct_present'] = $grand['total_sched'] > 0
            ? round($grand['total_present'] / $grand['total_sched'] * 100, 1) : 0;
        $grand['pct_absent']  = $grand['total_sched'] > 0
            ? round($grand['total_absent']  / $grand['total_sched'] * 100, 1) : 0;
        $result[] = ['type' => 'grand_total', 'label' => 'Grand Total', 'data' => $grand];

        return response()->json(['date' => $date, 'factory' => $factory, 'rows' => $result]);
    }

    private function tallyRow(string $label, string $type, $emps, array $checkedIn, array $empShift = [], bool $isToday = false, string $rowType = 'station'): array
    {
        $dl_sched    = $train_sched  = 0;
        $dl_present  = $train_present= 0;
        $dl_absent   = $train_absent = 0;

        foreach ($emps as $emp) {
            $eid       = (string)(int)$emp->EMPLOYID;
            $isTrain   = in_array($emp->CERTIFICATION_STATUS ?? '', ['BUDDY', 'CLASSROOM']);
            $isPresent = isset($checkedIn[$eid]);
            $shift     = $empShift[$eid] ?? null;
            // Scheduled OT (9,10) only counts as restday if no check-in.
            $isRestday = $shift && $this->isEffectiveRestday((int)($shift['shift_id'] ?? 0), $isPresent);
            $isNight   = $shift && $shift['type'] === 'night';

            // Skip absent for restday employees
            if (!$isPresent && $isRestday) continue;
            // Skip absent for night shift only if today AND shift not ended (before 07:00)
            if (!$isPresent && $isToday && $isNight) continue; // night shift always pending on shift date

            if ($isTrain) {
                $train_sched++;
                if ($isPresent) $train_present++; else $train_absent++;
            } else {
                // DL = Certified + Non-Certified combined
                $dl_sched++;
                if ($isPresent) $dl_present++; else $dl_absent++;
            }
        }

        $total_sched   = $dl_sched    + $train_sched;
        $total_present = $dl_present  + $train_present;
        $total_absent  = $dl_absent   + $train_absent;

        return ['type' => $type, 'label' => $label, 'row_type' => $rowType, 'data' => [
            'dl_sched'      => $dl_sched,
            'train_sched'   => $train_sched,
            'total_sched'   => $total_sched,
            'pct_present'   => $total_sched > 0 ? round($total_present / $total_sched * 100, 1) : 0,
            'dl_present'    => $dl_present,
            'train_present' => $train_present,
            'total_present' => $total_present,
            'dl_absent'     => $dl_absent,
            'train_absent'  => $train_absent,
            'total_absent'  => $total_absent,
            'pct_absent'    => $total_sched > 0 ? round($total_absent  / $total_sched * 100, 1) : 0,
        ]];
    }

    private function sumRows(string $label, string $type, array $rows): array
    {
        $data = [
            'dl_sched'      => 0, 'train_sched'   => 0, 'total_sched'   => 0,
            'dl_present'    => 0, 'train_present' => 0, 'total_present' => 0,
            'dl_absent'     => 0, 'train_absent'  => 0, 'total_absent'  => 0,
        ];
        foreach ($rows as $r) {
            foreach (array_keys($data) as $k) {
                $data[$k] += $r['data'][$k] ?? 0;
            }
        }
        $data['pct_present'] = $data['total_sched'] > 0
            ? round($data['total_present'] / $data['total_sched'] * 100, 1) : 0;
        $data['pct_absent']  = $data['total_sched'] > 0
            ? round($data['total_absent']  / $data['total_sched'] * 100, 1) : 0;
        return ['type' => $type, 'label' => $label, 'data' => $data];
    }
}

