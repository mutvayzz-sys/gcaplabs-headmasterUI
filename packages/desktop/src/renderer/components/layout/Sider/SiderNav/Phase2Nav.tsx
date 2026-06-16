/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  HouseLine,
  ChatCircle,
  Pulse,
  Books,
  Brain,
  Clock,
  GitBranch,
  Users,
  Plugs,
  Kanban,
  GearSix,
  Globe,
  Images,
} from '@phosphor-icons/react';
import type { SiderTooltipProps } from '@renderer/utils/ui/siderTooltip';
import { SiderNavEntry } from './index';

interface Phase2NavProps {
  isMobile: boolean;
  collapsed: boolean;
  siderTooltipProps: SiderTooltipProps;
  onNavClick?: () => void;
}

const NAV_ITEMS = [
  { path: '/dashboard', icon: HouseLine, labelKey: 'sidebar.dashboard', defaultLabel: 'Dashboard' },
  { path: '/guid', icon: ChatCircle, labelKey: 'sidebar.chat', defaultLabel: 'Chat' },
  { path: '/activity', icon: Pulse, labelKey: 'sidebar.activity', defaultLabel: 'Activity' },
  { path: '/documents', icon: Books, labelKey: 'sidebar.documents', defaultLabel: 'Documents' },
  { path: '/memory', icon: Brain, labelKey: 'sidebar.memory', defaultLabel: 'Memory' },
  { path: '/scheduled', icon: Clock, labelKey: 'sidebar.automations', defaultLabel: 'Automations' },
  { path: '/workflows', icon: GitBranch, labelKey: 'sidebar.skills', defaultLabel: 'Skills' },
  { path: '/agents', icon: Users, labelKey: 'sidebar.agents', defaultLabel: 'Agents' },
  { path: '/integrations', icon: Plugs, labelKey: 'sidebar.integrations', defaultLabel: 'Integrations' },
  { path: '/browser', icon: Globe, labelKey: 'sidebar.browser', defaultLabel: 'Browser' },
  { path: '/assets', icon: Images, labelKey: 'sidebar.assets', defaultLabel: 'Assets' },
  { path: '/kanban', icon: Kanban, labelKey: 'sidebar.kanban', defaultLabel: 'Kanban' },
  { path: '/settings/model', icon: GearSix, labelKey: 'sidebar.settings', defaultLabel: 'Settings' },
];

export default function Phase2Nav({ isMobile, collapsed, siderTooltipProps, onNavClick }: Phase2NavProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { pathname } = location;

  const handleClick = (path: string) => {
    navigate(path);
    onNavClick?.();
  };

  return (
    <div className='flex flex-col gap-2px shrink-0'>
      {NAV_ITEMS.map((item) => {
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
          />
        );
      })}
    </div>
  );
}
