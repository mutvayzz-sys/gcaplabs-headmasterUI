import React, { Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import AppLoader from '@renderer/components/layout/AppLoader';
import { useAuth } from '@renderer/hooks/context/AuthContext';
import { TEAM_MODE_ENABLED } from '@/common/config/constants';
const Conversation = React.lazy(() => import('@renderer/pages/conversation'));
const Guid = React.lazy(() => import('@renderer/pages/guid'));
const AgentSettings = React.lazy(() => import('@renderer/pages/settings/AgentSettings'));
const AssistantSettings = React.lazy(() => import('@renderer/pages/settings/AssistantSettings'));
const AppearanceSettings = React.lazy(() => import('@renderer/pages/settings/AppearanceSettings'));
const ModeSettings = React.lazy(() => import('@renderer/pages/settings/ModeSettings'));
const SystemSettings = React.lazy(() => import('@renderer/pages/settings/SystemSettings'));
const ExtensionSettingsPage = React.lazy(() => import('@renderer/pages/settings/ExtensionSettingsPage'));
const RuntimeSettings = React.lazy(() => import('@renderer/pages/settings/RuntimeSettings'));
const MemorySettings = React.lazy(() => import('@renderer/pages/settings/MemorySettings'));
const AdvancedSettings = React.lazy(() => import('@renderer/pages/settings/AdvancedSettings'));
const LoginPage = React.lazy(() => import('@renderer/pages/login'));
const ComponentsShowcase = React.lazy(() => import('@renderer/pages/TestShowcase'));
const ScheduledTasksPage = React.lazy(() => import('@renderer/pages/cron/ScheduledTasksPage'));
const TaskDetailPage = React.lazy(() => import('@renderer/pages/cron/ScheduledTasksPage/TaskDetailPage'));
const TeamIndex = React.lazy(() => import('@renderer/pages/team'));

// Phase 2 stub pages
const DashboardPage = React.lazy(() => import('@renderer/pages/dashboard'));
const ActivityPage = React.lazy(() => import('@renderer/pages/activity'));
const DocumentsPage = React.lazy(() => import('@renderer/pages/documents'));
const MemoryPage = React.lazy(() => import('@renderer/pages/memory'));
const WorkflowsPage = React.lazy(() => import('@renderer/pages/workflows'));
const AgentsPage = React.lazy(() => import('@renderer/pages/agents'));
const KanbanPage = React.lazy(() => import('@renderer/pages/kanban'));
const BrowserPage = React.lazy(() => import('@renderer/pages/browser'));
const AssetsPage = React.lazy(() => import('@renderer/pages/assets'));

const withRouteFallback = (Component: React.LazyExoticComponent<React.ComponentType>) => (
  <Suspense fallback={<AppLoader />}>
    <Component />
  </Suspense>
);

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
          <Route path='/settings/assistants' element={withRouteFallback(AssistantSettings)} />
          <Route path='/settings/agent' element={withRouteFallback(AgentSettings)} />
          <Route path='/settings/hermes' element={withRouteFallback(RuntimeSettings)} />
          <Route path='/settings/runtime' element={<Navigate to='/settings/hermes' replace />} />
          <Route path='/settings/memory' element={withRouteFallback(MemorySettings)} />
          <Route path='/settings/capabilities' element={<Navigate to='/settings/advanced' replace />} />
          <Route path='/settings/integrations' element={<Navigate to='/settings/advanced' replace />} />
          {/* Legacy routes — redirect to the merged Advanced Settings page */}
          <Route path='/settings/skills-hub' element={<Navigate to='/settings/advanced' replace />} />
          <Route path='/settings/tools' element={<Navigate to='/settings/advanced' replace />} />
          <Route path='/settings/appearance' element={withRouteFallback(AppearanceSettings)} />
          <Route path='/settings/display' element={<Navigate to='/settings/appearance' replace />} />
          <Route path='/settings/webui' element={<Navigate to='/settings/advanced' replace />} />
          <Route path='/settings/advanced' element={withRouteFallback(AdvancedSettings)} />
          <Route path='/settings/system' element={withRouteFallback(SystemSettings)} />
          <Route path='/settings/about' element={withRouteFallback(SystemSettings)} />
          <Route path='/settings/ext/:tabId' element={withRouteFallback(ExtensionSettingsPage)} />
          <Route path='/settings' element={<Navigate to='/settings/model' replace />} />
          <Route path='/test/components' element={withRouteFallback(ComponentsShowcase)} />
          <Route path='/scheduled' element={withRouteFallback(ScheduledTasksPage)} />
          <Route path='/scheduled/:job_id' element={withRouteFallback(TaskDetailPage)} />
          {/* Phase 2 routes — stubs for upcoming screens */}
          <Route path='/dashboard' element={withRouteFallback(DashboardPage)} />
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
          <Route path='/council' element={<Navigate to='/team/:id' replace />} />
        </Route>
        <Route path='*' element={<Navigate to={status === 'authenticated' ? '/guid' : '/login'} replace />} />
      </Routes>
    </HashRouter>
  );
};

export default PanelRoute;
