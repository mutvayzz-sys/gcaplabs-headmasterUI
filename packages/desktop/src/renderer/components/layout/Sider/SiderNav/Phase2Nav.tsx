/**
 * @license
 * Copyright 2025 Headmaster (gcaplabs.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChatCircle,
  Brain,
  Clock,
  Users,
  Kanban,
  GearSix,
  Package,
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
  { path: '/guid', icon: ChatCircle, labelKey: 'sidebar.chat', defaultLabel: 'Chat' },
  { path: '/memory', icon: Brain, labelKey: 'sidebar.memory', defaultLabel: 'Memory' },
  { path: '/agents', icon: Users, labelKey: 'sidebar.agents', defaultLabel: 'Agents' },
  { path: '/scheduled', icon: Clock, labelKey: 'sidebar.automations', defaultLabel: 'Automations' },
  { path: '/kanban', icon: Kanban, labelKey: 'sidebar.kanban', defaultLabel: 'Kanban' },
  { path: '/assets', icon: Package, labelKey: 'sidebar.deliverables', defaultLabel: 'Deliverables' },
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
