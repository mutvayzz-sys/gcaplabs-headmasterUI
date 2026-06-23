import React, { Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes, useSearchParams } from 'react-router-dom';
import AppLoader from '@renderer/components/layout/AppLoader';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import { TEAM_MODE_ENABLED } from '@/common/config/constants';
const Conversation = React.lazy(() => import('@renderer/pages/conversation'));
const Guid = React.lazy(() => import('@renderer/pages/guid'));
const AppearanceSettings = React.lazy(() => import('@renderer/pages/settings/AppearanceSettings'));
const ModeSettings = React.lazy(() => import('@renderer/pages/settings/ModeSettings'));
const SystemSettings = React.lazy(() => import('@renderer/pages/settings/SystemSettings'));
const AboutSettings = React.lazy(() => import('@renderer/pages/settings/AboutSettings'));
const ExtensionSettingsPage = React.lazy(() => import('@renderer/pages/settings/ExtensionSettingsPage'));
const RuntimeSettings = React.lazy(() => import('@renderer/pages/settings/RuntimeSettings'));
const MemorySettings = React.lazy(() => import('@renderer/pages/settings/MemorySettings'));
const ToolsSettingsPage = React.lazy(() => import('@renderer/pages/settings/ToolsSettingsPage'));
const SkillsHubSettings = React.lazy(() => import('@renderer/pages/settings/SkillsHubSettings'));
const IntegrationsSettingsPage = React.lazy(() => import('@renderer/pages/settings/IntegrationsSettingsPage'));
const ChannelsSettingsPage = React.lazy(() => import('@renderer/pages/settings/ChannelsSettingsPage'));
const LoginPage = React.lazy(() => import('@renderer/pages/login'));
const ComponentsShowcase = React.lazy(() => import('@renderer/pages/TestShowcase'));
const ScheduledTasksPage = React.lazy(() => import('@renderer/pages/cron/ScheduledTasksPage'));
const TaskDetailPage = React.lazy(() => import('@renderer/pages/cron/ScheduledTasksPage/TaskDetailPage'));
const TeamIndex = React.lazy(() => import('@renderer/pages/team'));

// Phase 2 stub pages
const ActivityPage = React.lazy(() => import('@renderer/pages/activity'));
const DocumentsPage = React.lazy(() => import('@renderer/pages/documents'));
const MemoryPage = React.lazy(() => import('@renderer/pages/memory'));
const WorkflowsPage = React.lazy(() => import('@renderer/pages/workflows'));
const AgentsPage = React.lazy(() => import('@renderer/pages/agents'));
const KanbanPage = React.lazy(() => import('@renderer/pages/kanban'));
const BrowserPage = React.lazy(() => import('@renderer/pages/browser'));
const AssetsPage = React.lazy(() => import('@renderer/pages/assets'));

export const SETTINGS_PRIMARY_ROUTES = {
  tools: '/settings/tools',
  skills: '/settings/skills-hub',
  integrations: '/settings/integrations',
  channels: '/settings/channels',
} as const;

export const SETTINGS_LEGACY_REDIRECTS = {
  '/settings/capabilities': SETTINGS_PRIMARY_ROUTES.tools,
  '/settings/skills': SETTINGS_PRIMARY_ROUTES.skills,
  '/settings/webui': SETTINGS_PRIMARY_ROUTES.channels,
  '/settings/advanced': SETTINGS_PRIMARY_ROUTES.tools,
} as const;

const withRouteFallback = (Component: React.LazyExoticComponent<React.ComponentType>) => (
  <Suspense fallback={<AppLoader />}>
    <Component />
  </Suspense>
);

const AssistantsRedirect: React.FC = () => {
  const [searchParams] = useSearchParams();
  const highlight = searchParams.get('highlight');
  const target = highlight
    ? `/agents?tab=specialists&highlight=${encodeURIComponent(highlight)}`
    : '/agents?tab=specialists';
  return <Navigate to={target} replace />;
};

const AgentSettingsRedirect: React.FC = () => {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const targetTab = tab === 'local' ? 'engines' : tab === 'remote' ? 'engines' : 'engines';
  const extra = new URLSearchParams(searchParams);
  extra.set('tab', targetTab);
  return <Navigate to={`/agents?${extra.toString()}`} replace />;
};

const ProtectedLayout: React.FC<{ layout: React.ReactElement }> = ({ layout }) => {
  const { status } = useAuth();

  if (status === 'checking') {
    return <AppLoader />;
  }

  if (status !== 'authenticated') {
    return <Navigate to='/login' replace />;
  }

  return React.cloneElement(layout);
};

const PanelRoute: React.FC<{ layout: React.ReactElement }> = ({ layout }) => {
  const { status } = useAuth();

  return (
    <HashRouter>
      <Routes>
        <Route
          path='/login'
          element={status === 'authenticated' ? <Navigate to='/guid' replace /> : withRouteFallback(LoginPage)}
        />
        <Route element={<ProtectedLayout layout={layout} />}>
          <Route index element={<Navigate to='/guid' replace />} />
          <Route path='/guid' element={withRouteFallback(Guid)} />
          <Route path='/conversation/:id' element={withRouteFallback(Conversation)} />
          <Route
            path='/team/:id'
            element={TEAM_MODE_ENABLED ? withRouteFallback(TeamIndex) : <Navigate to='/guid' replace />}
          />
          <Route path='/settings/model' element={withRouteFallback(ModeSettings)} />
          <Route path='/settings/assistants' element={<AssistantsRedirect />} />
          <Route path='/settings/agent' element={<AgentSettingsRedirect />} />
          <Route path='/settings/hermes' element={<Navigate to='/settings/runtime' replace />} />
          <Route path='/settings/runtime' element={withRouteFallback(RuntimeSettings)} />
          <Route path='/settings/memory' element={withRouteFallback(MemorySettings)} />
          <Route
            path='/settings/capabilities'
            element={<Navigate to={SETTINGS_LEGACY_REDIRECTS['/settings/capabilities']} replace />}
          />
          <Route path={SETTINGS_PRIMARY_ROUTES.integrations} element={withRouteFallback(IntegrationsSettingsPage)} />
          <Route path={SETTINGS_PRIMARY_ROUTES.skills} element={withRouteFallback(SkillsHubSettings)} />
          <Route
            path='/settings/skills'
            element={<Navigate to={SETTINGS_LEGACY_REDIRECTS['/settings/skills']} replace />}
          />
          <Route path={SETTINGS_PRIMARY_ROUTES.tools} element={withRouteFallback(ToolsSettingsPage)} />
          <Route path={SETTINGS_PRIMARY_ROUTES.channels} element={withRouteFallback(ChannelsSettingsPage)} />
          <Route path='/settings/appearance' element={withRouteFallback(AppearanceSettings)} />
          <Route path='/settings/display' element={<Navigate to='/settings/appearance' replace />} />
          <Route path='/settings/webui' element={<Navigate to={SETTINGS_LEGACY_REDIRECTS['/settings/webui']} replace />} />
          <Route
            path='/settings/advanced'
            element={<Navigate to={SETTINGS_LEGACY_REDIRECTS['/settings/advanced']} replace />}
          />
          <Route path='/settings/system' element={withRouteFallback(SystemSettings)} />
          <Route path='/settings/about' element={withRouteFallback(AboutSettings)} />
          <Route path='/settings/ext/:tabId' element={withRouteFallback(ExtensionSettingsPage)} />
          <Route path='/settings' element={<Navigate to='/settings/model' replace />} />
          <Route path='/test/components' element={withRouteFallback(ComponentsShowcase)} />
          <Route path='/scheduled' element={withRouteFallback(ScheduledTasksPage)} />
          <Route path='/scheduled/:job_id' element={withRouteFallback(TaskDetailPage)} />
          {/* Phase 2 routes — stubs for upcoming screens */}
          <Route path='/dashboard' element={<Navigate to='/guid' replace />} />
          <Route path='/activity' element={withRouteFallback(ActivityPage)} />
          <Route path='/documents' element={withRouteFallback(DocumentsPage)} />
          <Route path='/memory' element={withRouteFallback(MemoryPage)} />
          <Route path='/workflows' element={withRouteFallback(WorkflowsPage)} />
          <Route path='/agents' element={withRouteFallback(AgentsPage)} />
          <Route path='/integrations' element={<Navigate to='/settings/integrations' replace />} />
          <Route path='/kanban' element={withRouteFallback(KanbanPage)} />
          <Route path='/browser' element={withRouteFallback(BrowserPage)} />
          <Route path='/assets' element={withRouteFallback(AssetsPage)} />
          {/* Aliases */}
          <Route path='/automations' element={<Navigate to='/scheduled' replace />} />
          <Route path='/council' element={<Navigate to='/team/default' replace />} />
        </Route>
        <Route path='*' element={<Navigate to={status === 'authenticated' ? '/guid' : '/login'} replace />} />
      </Routes>
    </HashRouter>
  );
};

export default PanelRoute;
