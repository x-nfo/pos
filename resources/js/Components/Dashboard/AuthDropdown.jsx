import React, { useState, useRef, useEffect } from "react";
import { Menu, Transition } from "@headlessui/react";
import { Link, usePage } from "@inertiajs/react";
import { IconLogout, IconUserCog } from "@tabler/icons-react";
import { useForm } from "@inertiajs/react";
import MenuLink from "@/Utils/Menu";
import LinkItem from "./LinkItem";
import LinkItemDropdown from "./LinkItemDropdown";
export default function AuthDropdown({ auth, isMobile }) {
    // define usefrom
    const { post } = useForm();
    // define url from usepage
    const { url } = usePage();

    // define state isToggle
    const [isToggle, setIsToggle] = useState(false);
    // define state isOpen
    const [isOpen, setIsOpen] = useState(false);
    // define ref dropdown
    const dropdownRef = useRef(null);

    // define method handleClickOutside
    const handleClickOutside = (event) => {
        if (
            dropdownRef.current &&
            !dropdownRef.current.contains(event.target)
        ) {
            setIsToggle(false);
        }
    };

    // get menu from utils
    const menuNavigation = MenuLink();

    // define useEffect
    useEffect(() => {
        // add event listener
        window.addEventListener("mousedown", handleClickOutside);

        // remove event listener
        return () => {
            window.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // define function logout
    const logout = async (e) => {
        e.preventDefault();

        post(route("logout"));
    };

    const avatarUrl = auth.user.avatar;
    const userInitial =
        auth.user.name?.charAt(0)?.toUpperCase() ??
        auth.user.email?.charAt(0)?.toUpperCase() ??
        "?";

    return (
        <>
            {isMobile === false ? (
                <Menu className="relative z-10" as="div">
                    <Menu.Button className="flex items-center rounded-xl overflow-hidden focus:outline-none active:scale-95 transition-all">
                        {avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt={auth.user.name}
                                className="w-9 h-9 rounded-xl object-cover"
                            />
                        ) : (
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary-600 to-primary-700 text-white flex items-center justify-center font-black text-xs shadow-xs">
                                {userInitial}
                            </div>
                        )}
                    </Menu.Button>
                    <Transition
                        enter="transition duration-100 ease-out"
                        enterFrom="transform scale-95 opacity-0"
                        enterTo="transform scale-100 opacity-100"
                        leave="transition duration-75 ease-out"
                        leaveFrom="transform scale-100 opacity-100"
                        leaveTo="transform scale-95 opacity-0"
                    >
                        <Menu.Items className="absolute rounded-2xl w-48 border mt-2 py-1.5 right-0 z-[100] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl">
                            <div className="flex flex-col gap-1 px-1">
                                <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                                    <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                                        {auth.user.name}
                                    </p>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                        {auth.user.email}
                                    </p>
                                </div>
                                <Menu.Item>
                                    <button
                                        onClick={logout}
                                        className="w-full px-3 py-2 text-xs font-semibold flex items-center gap-2 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40 rounded-xl transition-colors"
                                    >
                                        <IconLogout
                                            strokeWidth={1.8}
                                            size={16}
                                        />
                                        Logout
                                    </button>
                                </Menu.Item>
                            </div>
                        </Menu.Items>
                    </Transition>
                </Menu>
            ) : (
                <div ref={dropdownRef}>
                    <Link
                        href={route("dashboard.menu")}
                        className="flex items-center rounded-xl overflow-hidden active:scale-95 transition-all"
                        title="Menu Pengguna"
                    >
                        {avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt={auth.user.name}
                                className="w-8 h-8 rounded-xl object-cover"
                            />
                        ) : (
                            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-primary-600 to-primary-700 text-white flex items-center justify-center font-black text-xs shadow-xs">
                                {userInitial}
                            </div>
                        )}
                    </Link>
                </div>
            )}
        </>
    );
}
