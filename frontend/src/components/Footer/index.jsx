import System from "@/models/system";
import { fetchMetacanonFeatures } from "@/models/metacanonLibrary";
import paths from "@/utils/paths";
import { BookOpen } from "@phosphor-icons/react/dist/csr/BookOpen";
import { DiscordLogo } from "@phosphor-icons/react/dist/csr/DiscordLogo";
import { Desktop } from "@phosphor-icons/react/dist/csr/Desktop";
import { FileText } from "@phosphor-icons/react/dist/csr/FileText";
import { Eyeglasses } from "@phosphor-icons/react/dist/csr/Eyeglasses";
import { GithubLogo } from "@phosphor-icons/react/dist/csr/GithubLogo";
import { Info } from "@phosphor-icons/react/dist/csr/Info";
import { LinkSimple } from "@phosphor-icons/react/dist/csr/LinkSimple";
import { UserCircle } from "@phosphor-icons/react/dist/csr/UserCircle";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Tooltip } from "react-tooltip";
import { Link } from "react-router-dom";
import PrismHoverTarget from "@/components/PrismHoverTarget";
import { useTheme } from "@/hooks/useTheme";
import SettingsButton from "@/components/SettingsButton";
import { QRCodeSVG } from "qrcode.react";
import dodecaIdleDark from "@/media/metacanon/dodeca-idle-dark.png";
import dodecaIdleLight from "@/media/metacanon/dodeca-idle-light.png";
import dodecaIdleCathedral from "@/media/metacanon/dodeca-idle-cathedral.png";
import {
  BITCOIN_SUPPORT_ADDRESS,
  BITCOIN_SUPPORT_LABEL,
  BITCOIN_SUPPORT_MESSAGE,
  getBitcoinSupportUri,
  hasBitcoinSupportAddress,
} from "@/utils/metacanonSupport";
import {
  prismExperimentalSurfacesEnabled,
  prismRepoLabEnabled,
} from "@/utils/prism/surfaces";

export const MAX_ICONS = 3;
export const ICON_COMPONENTS = {
  BookOpen: BookOpen,
  DiscordLogo: DiscordLogo,
  FileText: FileText,
  GithubLogo: GithubLogo,
  LinkSimple: LinkSimple,
  Desktop: Desktop,
  UserCircle: UserCircle,
  Info: Info,
  Eyeglasses: Eyeglasses,
};

function MetacanonBadgeIcon({ className = "h-3.5 w-3.5" }) {
  const { isLightTheme, resolvedTheme } = useTheme();
  const src =
    resolvedTheme === "cathedral"
      ? dodecaIdleCathedral
      : isLightTheme
        ? dodecaIdleLight
        : dodecaIdleDark;
  return <img src={src} alt="" aria-hidden="true" className={className} />;
}

export default function Footer() {
  const [footerData, setFooterData] = useState([]);
  const [metacanonFeatures, setMetacanonFeatures] = useState(null);
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const supportRef = useRef(null);
  const bitcoinUri = useMemo(() => getBitcoinSupportUri(), []);
  const hasBitcoinAddress = useMemo(() => hasBitcoinSupportAddress(), []);
  const experimentalPrismEnabled = useMemo(
    () => prismExperimentalSurfacesEnabled(),
    []
  );
  const repoLabEnabled = useMemo(
    () => prismRepoLabEnabled() && !!metacanonFeatures?.repoLabReadEnabled,
    [metacanonFeatures]
  );

  useEffect(() => {
    async function fetchFooterData() {
      const { footerData } = await System.fetchCustomFooterIcons();
      setFooterData(footerData);
    }
    fetchFooterData();
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchMetacanonFeatures()
      .then((features) => {
        if (!cancelled) setMetacanonFeatures(features);
      })
      .catch((error) => {
        console.warn(
          "Failed to hydrate Metacanon feature flags for footer.",
          error
        );
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!supportRef.current?.contains(event.target)) {
        setIsSupportOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const footerIcons = !Array.isArray(footerData) ? [] : footerData;

  const renderFooterItem = ({
    key,
    href,
    label,
    tooltip,
    icon,
    external = true,
    hoverTargetId = null,
  }) => {
    const button = (
      <Link
        to={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noreferrer" : undefined}
        className="metacanon-footer-button flex h-[26px] w-[26px] items-center justify-center rounded-full p-[4px] transition-all duration-300"
        aria-label={label}
        data-tooltip-id="footer-item"
        data-tooltip-content={tooltip}
      >
        {icon}
      </Link>
    );

    return (
      <div key={key} className="flex w-fit shrink-0">
        {hoverTargetId ? (
          <PrismHoverTarget targetId={hoverTargetId}>{button}</PrismHoverTarget>
        ) : (
          button
        )}
      </div>
    );
  };

  const defaultFooterItems = [
    {
      key: "github",
      href: paths.github(),
      label: "GitHub",
      tooltip: "View Source Code",
      icon: (
        <GithubLogo
          weight="fill"
          className="h-3.5 w-3.5"
          color="var(--theme-sidebar-footer-icon-fill)"
        />
      ),
    },
    {
      key: "docs",
      href: paths.docs(),
      label: "Docs",
      tooltip: "Open PrismAI help docs",
      icon: (
        <BookOpen
          weight="fill"
          className="h-3.5 w-3.5"
          color="var(--theme-sidebar-footer-icon-fill)"
        />
      ),
    },
    {
      key: "handbook",
      href: paths.handbook(),
      label: "PrismAI User Manual",
      tooltip:
        "Read the PrismAI users manual, learn about Transformation Agency and the Metacanon AI Constitutional Governance for Human-AI interaction, Multi Agent Governed Coordination, The Lens Library, and more.",
      icon: (
        <Eyeglasses
          weight="fill"
          className="h-3.5 w-3.5"
          color="var(--theme-sidebar-footer-icon-fill)"
        />
      ),
    },
    {
      key: "discord",
      href: paths.discord(),
      label: "Discord",
      tooltip: "Join the AnythingLLM Discord",
      icon: (
        <DiscordLogo
          weight="fill"
          className="h-3.5 w-3.5"
          color="var(--theme-sidebar-footer-icon-fill)"
        />
      ),
    },
  ];

  if (experimentalPrismEnabled) {
    defaultFooterItems.push({
      key: "ui-lab",
      href: paths.metacanonAILab(),
      label: "UI Lab",
      tooltip: "Open UI Lab (experimental)",
      icon: (
        <BookOpen
          weight="fill"
          className="h-3.5 w-3.5"
          color="var(--theme-sidebar-footer-icon-fill)"
        />
      ),
      external: false,
    });
  }

  if (repoLabEnabled) {
    defaultFooterItems.push({
      key: "repo-lab",
      href: paths.metacanonAIRepoLab(),
      label: "Repo Lab",
      tooltip: "Open Repo Lab (experimental)",
      icon: (
        <FileText
          weight="fill"
          className="h-3.5 w-3.5"
          color="var(--theme-sidebar-footer-icon-fill)"
        />
      ),
      external: false,
    });
  }

  const footerItems =
    footerIcons.length > 0
      ? footerIcons.map((item, index) => ({
          key: `${item.icon}-${index}`,
          href: item.url,
          label: item.label || item.icon || "Footer link",
          tooltip: item.label || item.url,
          icon: React.createElement(
            ICON_COMPONENTS?.[item.icon] ?? ICON_COMPONENTS.Info,
            {
              weight: "fill",
              className: "h-3.5 w-3.5",
              color: "var(--theme-sidebar-footer-icon-fill)",
            }
          ),
        }))
      : defaultFooterItems;

  const metacanonItem = {
    key: "metacanonai",
    href: paths.metacanonAI(),
    label: "Open PrismAI control center",
    tooltip: "MetaCanon control center",
    icon: <MetacanonBadgeIcon />,
    external: false,
    hoverTargetId: "footer-metacanonai",
  };

  return (
    <div className="flex w-full justify-center px-1.5 pt-0.5 pb-0">
      <div className="metacanon-footer-dock relative flex w-fit max-w-full flex-nowrap items-center gap-2 rounded-[15px] px-1 py-0.5">
        {renderFooterItem(metacanonItem)}
        <div
          ref={supportRef}
          className="relative flex w-fit shrink-0"
          onMouseEnter={() => setIsSupportOpen(true)}
          onMouseLeave={() => setIsSupportOpen(false)}
        >
          <PrismHoverTarget targetId="footer-bitcoin-support">
            <button
              type="button"
              className="metacanon-footer-button flex h-[26px] w-[26px] items-center justify-center rounded-full p-[4px] transition-all duration-300"
              aria-label={BITCOIN_SUPPORT_LABEL}
              data-tooltip-id="footer-item"
              data-tooltip-content={BITCOIN_SUPPORT_LABEL}
              aria-expanded={isSupportOpen}
              onClick={() => setIsSupportOpen((open) => !open)}
            >
              <span className="metacanon-btc-glyph" aria-hidden="true">
                ₿
              </span>
            </button>
          </PrismHoverTarget>
          {isSupportOpen && (
            <div className="metacanon-support-popover">
              <p className="metacanon-support-popover__eyebrow">
                {BITCOIN_SUPPORT_LABEL}
              </p>
              <p className="metacanon-support-popover__copy">
                {BITCOIN_SUPPORT_MESSAGE}
              </p>
              {hasBitcoinAddress ? (
                <>
                  <div className="metacanon-support-popover__qr">
                    <QRCodeSVG
                      value={bitcoinUri}
                      size={112}
                      bgColor="transparent"
                      fgColor="currentColor"
                      level="M"
                    />
                  </div>
                  <p className="metacanon-support-popover__address">
                    {BITCOIN_SUPPORT_ADDRESS}
                  </p>
                </>
              ) : (
                <p className="metacanon-support-popover__placeholder">
                  Bitcoin address pending. Once you send it over, I’ll wire the
                  live QR here.
                </p>
              )}
            </div>
          )}
        </div>
        {footerItems.map((item) => renderFooterItem(item))}
        <div className="flex w-fit shrink-0">
          <SettingsButton />
        </div>
      </div>
      <Tooltip
        id="footer-item"
        place="top"
        delayShow={300}
        className="tooltip !text-xs z-99"
      />
    </div>
  );
}
