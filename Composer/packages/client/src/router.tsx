// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** @jsx jsx */
import { jsx, css } from '@emotion/react';
import React, { useEffect, Suspense } from 'react';
import { Router, Redirect, RouteComponentProps } from '@reach/router';
import { useRecoilValue } from 'recoil';
import formatMessage from 'format-message';

import { resolveToBasePath } from './utils/fileUtil';
import { NotFound } from './components/NotFound';
import { WebChatContainer } from './components/WebChat/WebChatContainer';
import { BASEPATH } from './constants';
import {
  dispatcherState,
  schemasState,
  botProjectIdsState,
  botOpeningState,
  pluginPagesSelector,
  botOpeningMessage,
} from './recoilModel';
import { localBotsSettingDataSelector, rootBotProjectIdSelector } from './recoilModel/selectors/project';
import { openAlertModal } from './components/Modal/AlertDialog';
import { dialogStyle } from './components/Modal/dialogStyle';
import { LoadingSpinner } from './components/LoadingSpinner';
import { PluginPageContainer } from './pages/plugin/PluginPageContainer';
import { botDisplayNameState, botProjectSpaceLoadedState } from './recoilModel/atoms';
import { mergePropertiesManagedByRootBot } from './recoilModel/dispatchers/utils/project';
import languageStorage from './utils/languageStorage';
import { DebugPanel } from './pages/design/DebugPanel/DebugPanel';
import { useDebugPane } from './components/useDebugPane';

const DesignPage = React.lazy(() => import('./pages/design/DesignPage'));
const LUPage = React.lazy(() => import('./pages/language-understanding/LUPage'));
const QnAPage = React.lazy(() => import('./pages/knowledge-base/QnAPage'));
const LGPage = React.lazy(() => import('./pages/language-generation/LGPage'));
const SettingPage = React.lazy(() => import('./pages/setting/SettingsPage'));
const BotProjectSettings = React.lazy(() => import('./pages/botProject/BotProjectSettings'));
const ExtensionsPage = React.lazy(() => import('./pages/extensions/ExtensionsPage'));
const Publish = React.lazy(() => import('./pages/publish/Publish'));
const BotCreationFlowRouter = React.lazy(() => import('./components/CreationFlow/CreationFlow'));
const FormDialogPage = React.lazy(() => import('./pages/form-dialog/FormDialogPage'));

export const root = css`
  height: calc(100vh - 50px);
  display: flex;
  flex-direction: row;
  overflow: hidden;

  label: Page;
`;

export const pageWrapper = css`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  width: 100%;

  label: PageWrapper;
`;

export const contentWrapper = css`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  height: 100%;
  position: relative;
  label: PageContent;
`;

const Routes = (props) => {
  const botOpening = useRecoilValue(botOpeningState);
  const pluginPages = useRecoilValue(pluginPagesSelector);
  const spinnerText = useRecoilValue(botOpeningMessage);
  const showDebugPanel = useDebugPane();

  return (
    <div css={root}>
      <div css={pageWrapper}>
        <div css={contentWrapper}>
          <WebChatContainer />
          <Suspense fallback={<LoadingSpinner />}>
            <Router basepath={BASEPATH} {...props}>
              <Redirect
                noThrow
                from="/bot/:projectId/language-generation"
                to="/bot/:projectId/language-generation/common"
              />
              <Redirect
                noThrow
                from="/bot/:projectId/language-understanding"
                to="/bot/:projectId/language-understanding/all"
              />
              <Redirect noThrow from="/bot/:projectId/knowledge-base" to="/bot/:projectId/knowledge-base/all" />
              <Redirect noThrow from="/bot/:projectId/publish" to="/bot/:projectId/publish/all" />
              <Redirect noThrow from="/" to={resolveToBasePath(BASEPATH, 'home')} />
              <ProjectRouter path="/bot/:projectId/skill/:skillId">
                <DesignPage path="dialogs/:dialogId/*" />
                <LUPage path="language-understanding/:dialogId/item/:luFileId/*" />
                <LUPage path="language-understanding/:dialogId/*" />
                <LGPage path="language-generation/all/*" />
                <LGPage path="language-generation/:dialogId/item/:lgFileId/*" />
                <LGPage path="language-generation/:dialogId/*" />
                <QnAPage path="knowledge-base/:dialogId/item/:qnaFileId/*" />
                <QnAPage path="knowledge-base/:dialogId/*" />
                <BotProjectSettings path="botProjectsSettings" />
                {pluginPages.map((page) => (
                  <PluginPageContainer
                    key={`${page.id}/${page.bundleId}`}
                    bundleId={page.bundleId}
                    path={`plugin/${page.id}/${page.bundleId}`}
                    pluginId={page.id}
                  />
                ))}
                <DesignPage path="*" />
              </ProjectRouter>
              <ProjectRouter path="/bot/:projectId">
                <DesignPage path="dialogs/:dialogId/*" />
                <LUPage path="language-understanding/:dialogId/item/:luFileId/*" />
                <LUPage path="language-understanding/:dialogId/*" />
                <LGPage path="language-generation/all/*" />
                <LGPage path="language-generation/:dialogId/item/:lgFileId/*" />
                <LGPage path="language-generation/:dialogId/*" />
                <QnAPage path="knowledge-base/:dialogId/*" />
                <Publish path="publish/:targetName" />
                <BotProjectSettings path="botProjectsSettings" />
                <FormDialogPage path="forms/:schemaId/*" />
                <FormDialogPage path="forms/*" />
                <DesignPage path="*" />
                {pluginPages.map((page) => (
                  <PluginPageContainer
                    key={`${page.id}/${page.bundleId}`}
                    bundleId={page.bundleId}
                    path={`plugin/${page.id}/${page.bundleId}`}
                    pluginId={page.id}
                  />
                ))}
              </ProjectRouter>
              <SettingPage path="settings/*" />
              <ExtensionsPage path="extensions/*" />
              <BotCreationFlowRouter path="projects/*" />
              <BotCreationFlowRouter path="home" />
              <NotFound default />
            </Router>
          </Suspense>
          {botOpening && (
            <div
              css={{
                position: 'absolute',
                top: 0,
                left: 0,
                bottom: 0,
                right: 0,
                background: 'rgba(255, 255, 255, 0.6)',
              }}
            >
              <LoadingSpinner inModal message={spinnerText} />
            </div>
          )}
        </div>
        {showDebugPanel && <DebugPanel />}
      </div>
    </div>
  );
};

const projectWrapper = css`
  overflow: auto;
  display: flex;
  flex-flow: column;
  height: 100%;
`;

const projectStyle = css`
  flex: auto;
  min-width: 1030px;
  min-height: 400px;

  & > div {
    height: 100%;
  }

  label: ProjectRouter;
`;

const ProjectRouter: React.FC<RouteComponentProps<{ projectId: string; skillId: string }>> = (props) => {
  const { projectId = '' } = props;
  const schemas = useRecoilValue(schemasState(projectId));
  const { fetchProjectById, setSettings, setLocale } = useRecoilValue(dispatcherState);
  const botProjects = useRecoilValue(botProjectIdsState);
  const localBots = useRecoilValue(localBotsSettingDataSelector);
  const botProjectSpaceLoaded = useRecoilValue(botProjectSpaceLoadedState);
  const rootBotProjectId = useRecoilValue(rootBotProjectIdSelector);
  const botName = useRecoilValue(botDisplayNameState(rootBotProjectId || ''));

  useEffect(() => {
    if (botProjectSpaceLoaded && rootBotProjectId && localBots) {
      for (let i = 0; i < localBots.length; i++) {
        const id = localBots[i].projectId;
        const setting = localBots[i].setting;
        const mergedSettings = mergePropertiesManagedByRootBot(id, rootBotProjectId, setting);
        setSettings(id, mergedSettings);
      }
      const storedLocale = languageStorage.get(botName)?.locale;
      if (storedLocale) {
        setLocale(storedLocale, rootBotProjectId);
      }
    }
  }, [botProjectSpaceLoaded, rootBotProjectId, botProjects]);

  useEffect(() => {
    if (props.projectId && !botProjects.includes(props.projectId)) {
      fetchProjectById(props.projectId);
    }
  }, [props.projectId]);

  useEffect(() => {
    const schemaError = schemas?.diagnostics ?? [];
    if (schemaError.length !== 0) {
      const title = formatMessage('Error Processing Schema');
      const subTitle = schemaError.join('\n');
      openAlertModal(title, subTitle, { style: dialogStyle.console });
    }
  }, [schemas, projectId]);
  if (props.projectId && botProjects.includes(props.projectId)) {
    if (props.skillId && !botProjects.includes(props.skillId)) {
      return <LoadingSpinner />;
    } else {
      return (
        <div css={projectWrapper}>
          <div css={projectStyle}>{props.children}</div>
        </div>
      );
    }
  }
  return <LoadingSpinner />;
};

export default Routes;
