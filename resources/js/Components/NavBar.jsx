import { usePage } from "@inertiajs/react";
import { useState, useContext } from "react";
import { ThemeContext } from "./ThemeContext";
import { cn } from "@/lib/utils";
import { Button } from "@/Components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/Components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/Components/ui/avatar";
import { ChevronDown, User, LogOut, Loader2 } from "lucide-react";
import ThemeToggler from "./sidebar/ThemeToggler";

export default function NavBar() {
    const { emp_data } = usePage().props;
    const { theme, toggleTheme } = useContext(ThemeContext);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const logout = () => {
        setIsLoggingOut(true);
        localStorage.clear();
        sessionStorage.clear();
        setTimeout(() => {
            window.location.href = route("logout");
        }, 500);
    };

    const getInitials = (name) => {
        if (!name) return "?";
        return name
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);
    };

    const firstName = emp_data?.emp_firstname || "Guest";
    const isDark = theme === "dark";

    return (
        <nav className="sticky top-0 z-50 bg-background/70 backdrop-blur-md h-14 shadow-lg">
            <div className="px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-end h-[54px] gap-3">
                    {/* Theme Toggle */}
                    <ThemeToggler theme={theme} toggleTheme={toggleTheme} />

                    {/* Divider */}
                    <div className="w-px h-5 bg-border" />

                    {/* User Menu */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                className="flex items-center gap-2.5 px-2.5 py-1.5 h-auto rounded-full hover:bg-muted"
                            >
                                <div className="relative">
                                    <Avatar className="w-8 h-8">
                                        <AvatarFallback
                                            className={cn(
                                                "text-xs font-bold text-white",
                                                isDark
                                                    ? "bg-primary"
                                                    : "bg-primary",
                                            )}
                                        >
                                            {getInitials(firstName)}
                                        </AvatarFallback>
                                    </Avatar>

                                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-background rounded-full" />
                                </div>

                                <span className="text-sm font-medium hidden sm:block">
                                    Hello,{" "}
                                    <span className="font-semibold">
                                        {firstName}
                                    </span>
                                </span>

                                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                            </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent
                            align="end"
                            sideOffset={8}
                            className="w-56 rounded-2xl p-1.5 shadow-xl"
                        >
                            <div className="px-3 py-2.5">
                                <div className="text-sm font-semibold">
                                    {firstName}
                                </div>
                                <div className="text-xs text-emerald-500 flex items-center gap-1 mt-1">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                                    Active now
                                </div>
                            </div>

                            <DropdownMenuSeparator />

                            <DropdownMenuItem asChild>
                                <a
                                    href={route("profile.index")}
                                    className="flex items-center gap-2"
                                >
                                    <User className="w-4 h-4" />
                                    Profile
                                </a>
                            </DropdownMenuItem>

                            <DropdownMenuItem
                                onClick={logout}
                                disabled={isLoggingOut}
                                className="text-destructive focus:text-destructive"
                            >
                                {isLoggingOut ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <LogOut className="w-4 h-4" />
                                )}
                                <span>
                                    {isLoggingOut
                                        ? "Signing out..."
                                        : "Log out"}
                                </span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
        </nav>
    );
}
