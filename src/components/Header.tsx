"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { nav, site } from "@/lib/site";

export default function Header() {
  const [openMenu, setOpenMenu] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm">
      <div className="mx-auto flex max-w-[1210px] items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="shrink-0" aria-label={`${site.name} — home`}>
          <Image
            src="/images/logo-iaci.png"
            alt="Irish American Cultural Institute"
            width={140}
            height={96}
            priority
            className="h-16 w-auto lg:h-20"
          />
        </Link>

        {/* Desktop navigation. Each top-level item is a real link, matching the
            old site, with its children revealed on hover and keyboard focus. */}
        <nav aria-label="Main" className="hidden lg:block">
          <ul className="flex items-center gap-8">
            {nav.map((item) => (
              <li key={item.href} className="group relative">
                <Link
                  href={item.href}
                  className="block py-4 text-[17px] text-navy transition-colors hover:text-green"
                >
                  {item.label}
                </Link>

                {item.children && (
                  <ul
                    className="invisible absolute left-1/2 z-10 w-64 -translate-x-1/2 rounded-md bg-white py-2 opacity-0 shadow-lg transition
                               group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
                  >
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          className="block px-5 py-2 text-[15px] text-navy transition-colors hover:bg-mist hover:text-green"
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <a
            href={site.loginUrl}
            className="rounded-full bg-coral px-7 py-2.5 font-display font-semibold text-white transition-opacity hover:opacity-90"
          >
            Login
          </a>

          <button
            type="button"
            onClick={() => setOpenMenu((v) => !v)}
            aria-expanded={openMenu}
            aria-controls="mobile-nav"
            className="lg:hidden rounded p-2 text-navy"
          >
            <span className="sr-only">
              {openMenu ? "Close menu" : "Open menu"}
            </span>
            <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d={
                  openMenu
                    ? "M6 6l12 12M18 6L6 18"
                    : "M3 6h18M3 12h18M3 18h18"
                }
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </button>
        </div>
      </div>

      {openMenu && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t border-mist lg:hidden"
        >
          <ul className="mx-auto max-w-[1210px] px-5 py-2">
            {nav.map((item) => (
              <li key={item.href} className="border-b border-mist last:border-0">
                <Link
                  href={item.href}
                  onClick={() => setOpenMenu(false)}
                  className="block py-3 font-display font-semibold text-navy"
                >
                  {item.label}
                </Link>
                {item.children && (
                  <ul className="pb-2 pl-4">
                    {item.children.map((child) => (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          onClick={() => setOpenMenu(false)}
                          className="block py-2 text-[15px] text-navy/80"
                        >
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        </nav>
      )}
    </header>
  );
}
