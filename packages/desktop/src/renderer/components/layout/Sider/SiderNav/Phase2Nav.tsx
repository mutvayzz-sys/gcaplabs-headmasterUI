/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChatCircle, Brain, Clock, Users, Kanban, GearSix, Package, Plugs } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import type { SiderTooltipProps } from '@renderer/utils/ui/siderTooltip';
import { useCapabilities } from '@renderer/hooks/system/useCapabilities';
import { SiderNavEntry } from './index';

interface Phase2NavProps {
  isMobile: boolean;
  collapsed: boolean;
  siderTooltipProps: SiderTooltipProps;
  onNavClick?: () => void;
}

interface NavItem {
  path: string;
  icon: Icon;
  labelKey: string;
  defaultLabel: string;
  badge?: 'Beta';
  requiredCapability?: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/guid', icon: ChatCircle, labelKey: 'sidebar.chat', defaultLabel: 'Chat', requiredCapability: 'chat' },
  { path: '/memory', icon: Brain, labelKey: 'sidebar.memory', defaultLabel: 'Memory', badge: 'Beta', requiredCapability: 'chat' },
  { path: '/agents', icon: Users, labelKey: 'sidebar.agents', defaultLabel: 'Agents', badge: 'Beta', requiredCapability: 'terminal' },
  { path: '/scheduled', icon: Clock, labelKey: 'sidebar.automations', defaultLabel: 'Automations', badge: 'Beta', requiredCapability: 'cowork' },
  { path: '/kanban', icon: Kanban, labelKey: 'sidebar.kanban', defaultLabel: 'Kanban', badge: 'Beta', requiredCapability: 'cowork' },
  { path: '/assets', icon: Package, labelKey: 'sidebar.deliverables', defaultLabel: 'Deliverables', badge: 'Beta', requiredCapability: 'local_files' },
  { path: '/apps', icon: Plugs, labelKey: 'sidebar.apps', defaultLabel: 'Apps', badge: 'Beta', requiredCapability: 'integrations' },
  { path: '/settings/model', icon: GearSix, labelKey: 'sidebar.settings', defaultLabel: 'Settings', requiredCapability: 'runtime_settings' },
];

export default function Phase2Nav({ isMobile, collapsed, siderTooltipProps, onNavClick }: Phase2NavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname } = location;
  const { capabilities } = useCapabilities();

  const handleClick = (path: string) => {
    navigate(path);
    onNavClick?.();
  };

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (!item.requiredCapability) return true;
    return capabilities.includes(item.requiredCapability as any);
  });

  return (
    <div className='flex flex-col gap-2px shrink-0'>
      {visibleItems.map((item) => {
        const isActive = pathname === item.path || pathname.startsWith(item.path + '/');
        return (
          <SiderNavEntry
            key={item.path}
            isMobile={isMobile}
            isActive={isActive}
            collapsed={collapsed}
            siderTooltipProps={siderTooltipProps}
            onClick={() => handleClick(item.path)}
            icon={item.icon}
            labelKey={item.labelKey}
            defaultLabel={item.defaultLabel}
            badge={item.badge}
          />
        );
      })}
    </div>
  );
}
