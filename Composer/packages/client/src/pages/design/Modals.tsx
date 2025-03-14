// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

/** @jsx jsx */
import { jsx } from '@emotion/react';
import React, { Suspense, useMemo } from 'react';
import { EditorExtension, PluginConfig } from '@bfc/extension-client';
import { useRecoilValue, useRecoilState } from 'recoil';

import { LoadingSpinner } from '../../components/LoadingSpinner';
import { useShell } from '../../shell';
import plugins, { mergePluginConfigs } from '../../plugins';
import {
  dispatcherState,
  schemasState,
  showCreateDialogModalState,
  qnaFilesSelectorFamily,
  displaySkillManifestState,
  brokenSkillInfoState,
  brokenSkillRepairCallbackState,
  dialogModalInfoState,
  triggerModalInfoState,
  showAddSkillDialogModalState,
} from '../../recoilModel';
import { CreateQnAModal } from '../../components/QnA';
import { undoFunctionState } from '../../recoilModel/undo/history';
import { CreationFlowStatus } from '../../constants';
import { RepairSkillModalOptionKeys } from '../../components/RepairSkillModal';
import { createQnAOnState, exportSkillModalInfoState } from '../../recoilModel/atoms/appState';
import { OrchestratorForSkillsDialog } from '../../components/Orchestrator/OrchestratorForSkillsDialog';

import CreationModal from './creationModal';

const CreateSkillModal = React.lazy(() => import('../../components/AddRemoteSkillModal/CreateSkillModal'));
const RepairSkillModal = React.lazy(() => import('../../components/RepairSkillModal'));
const CreateDialogModal = React.lazy(() => import('./createDialogModal'));
const DisplayManifestModal = React.lazy(() => import('../../components/Modal/DisplayManifestModal'));
const ExportSkillModal = React.lazy(() => import('./exportSkillModal'));
const TriggerCreationModal = React.lazy(() => import('../../components/TriggerCreationModal'));

type ModalsProps = {
  projectId: string;
  rootBotId: string;
};
const Modals: React.FC<ModalsProps> = ({ projectId = '', rootBotId = '' }) => {
  const qnaFiles = useRecoilValue(qnaFilesSelectorFamily(projectId));
  const schemas = useRecoilValue(schemasState(projectId));

  const displaySkillManifestNameIdentifier = useRecoilValue(displaySkillManifestState);

  const showCreateDialogModal = useRecoilValue(showCreateDialogModalState);
  const undoFunction = useRecoilValue(undoFunctionState(projectId));
  const { commitChanges } = undoFunction;

  const {
    createDialog,
    dismissManifestModal,
    addRemoteSkillToBotProject,
    setCreationFlowStatus,
    setCreationFlowType,
    removeSkillFromBotProject,
    createQnAKBsFromUrls,
    createQnAKBFromScratch,
    createQnAKBFromQnAMaker,
    createTrigger,
    createTriggerForRemoteSkill,
    createQnATrigger,
    createDialogCancel,
    createQnADialogCancel,
  } = useRecoilValue(dispatcherState);

  const [triggerModalInfo, setTriggerModalInfo] = useRecoilState(triggerModalInfoState);
  const createQnAOnInfo = useRecoilValue(createQnAOnState);
  const [dialogModalInfo, setDialogModalInfo] = useRecoilState(dialogModalInfoState);
  const [exportSkillModalInfo, setExportSkillModalInfo] = useRecoilState(exportSkillModalInfoState);
  const [brokenSkillInfo, setBrokenSkillInfo] = useRecoilState(brokenSkillInfoState);
  const [brokenSkillRepairCallback, setBrokenSkillRepairCallback] = useRecoilState(brokenSkillRepairCallbackState);
  const [showAddSkillDialogModal, setAddSkillDialogModalVisibility] = useRecoilState(showAddSkillDialogModalState);

  const shell = useShell('DesignPage', projectId);

  const onTriggerCreationDismiss = () => {
    setTriggerModalInfo(undefined);
  };

  const pluginConfig: PluginConfig = useMemo(() => {
    const sdkUISchema = schemas?.ui?.content ?? {};
    const userUISchema = schemas?.uiOverrides?.content ?? {};
    return mergePluginConfigs({ uiSchema: sdkUISchema }, plugins, { uiSchema: userUISchema });
  }, [schemas?.ui?.content, schemas?.uiOverrides?.content]);

  async function handleCreateDialogSubmit(projectId, dialogName, dialogData) {
    setDialogModalInfo(undefined);
    await createDialog({ id: dialogName, content: dialogData, projectId });
    commitChanges();
  }

  const handleCreateQnA = async (data) => {
    const { projectId, dialogId } = createQnAOnInfo;
    if (!projectId || !dialogId) return;
    await createQnATrigger(projectId, dialogId);

    const { name, urls = [], locales, multiTurn, endpoint, kbId, kbName, subscriptionKey } = data;
    if (urls.length !== 0) {
      await createQnAKBsFromUrls({ id: dialogId, name, projectId, locales, urls, multiTurn });
    } else if (kbId && kbName && endpoint && locales.length) {
      await createQnAKBFromQnAMaker({
        id: dialogId,
        name,
        projectId,
        locales,
        endpoint,
        kbId,
        kbName,
        subscriptionKey,
      });
    } else {
      await createQnAKBFromScratch({ id: dialogId, name, projectId });
    }
    commitChanges();
  };

  const dialogCreateSource = dialogModalInfo ?? projectId;

  return (
    <Suspense fallback={<LoadingSpinner />}>
      {showCreateDialogModal && (
        <EditorExtension plugins={pluginConfig} projectId={dialogCreateSource} shell={shell}>
          <CreateDialogModal
            isOpen={showCreateDialogModal}
            projectId={dialogCreateSource}
            onDismiss={() => {
              createDialogCancel(dialogCreateSource);
              setDialogModalInfo(undefined);
            }}
            onSubmit={(dialogName, dialogData) => {
              handleCreateDialogSubmit(dialogModalInfo ?? projectId, dialogName, dialogData);
            }}
          />
        </EditorExtension>
      )}
      {showAddSkillDialogModal && (
        <CreateSkillModal
          addRemoteSkill={async (manifestUrl, endpointName, zipContent) => {
            setAddSkillDialogModalVisibility(false);
            await addRemoteSkillToBotProject(manifestUrl, endpointName, zipContent);
          }}
          addTriggerToRoot={async (dialogId, formData, skillId) => {
            await createTriggerForRemoteSkill(projectId, dialogId, formData, skillId);
            commitChanges();
          }}
          projectId={rootBotId}
          onDismiss={() => {
            setAddSkillDialogModalVisibility(false);
          }}
        />
      )}
      {exportSkillModalInfo && (
        <ExportSkillModal
          isOpen
          projectId={exportSkillModalInfo}
          onDismiss={() => setExportSkillModalInfo(undefined)}
          onSubmit={() => setExportSkillModalInfo(undefined)}
        />
      )}
      {triggerModalInfo && (
        <EditorExtension plugins={pluginConfig} projectId={projectId} shell={shell}>
          <TriggerCreationModal
            isOpen
            dialogId={triggerModalInfo.dialogId}
            projectId={triggerModalInfo.projectId}
            onDismiss={onTriggerCreationDismiss}
            onSubmit={async (dialogId, formData) => {
              await createTrigger(triggerModalInfo.projectId, dialogId, formData);
              commitChanges();
            }}
          />
        </EditorExtension>
      )}

      <CreateQnAModal
        dialogId={createQnAOnInfo.dialogId}
        projectId={createQnAOnInfo.projectId}
        qnaFiles={qnaFiles}
        onDismiss={() => {
          createQnADialogCancel({ projectId: createQnAOnInfo.projectId });
        }}
        onSubmit={handleCreateQnA}
      />

      <OrchestratorForSkillsDialog />

      {displaySkillManifestNameIdentifier && (
        <DisplayManifestModal
          skillNameIdentifier={displaySkillManifestNameIdentifier}
          onDismiss={() => dismissManifestModal()}
        />
      )}
      {brokenSkillInfo && (
        <RepairSkillModal
          skillItem={brokenSkillInfo}
          onDismiss={() => {
            setBrokenSkillInfo(undefined);
          }}
          onNext={(option) => {
            const skillIdToRemove = brokenSkillInfo.skillId;
            if (!skillIdToRemove) return;

            if (option === RepairSkillModalOptionKeys.repairSkill) {
              setCreationFlowType('Skill');
              setCreationFlowStatus(CreationFlowStatus.OPEN);
              setBrokenSkillRepairCallback(() => {
                removeSkillFromBotProject(skillIdToRemove);
              });
            } else if (option === RepairSkillModalOptionKeys.removeSkill) {
              removeSkillFromBotProject(skillIdToRemove);
            }
            setBrokenSkillInfo(undefined);
          }}
        ></RepairSkillModal>
      )}
      <CreationModal
        onSubmit={() => {
          if (brokenSkillRepairCallback) {
            brokenSkillRepairCallback();
          }
        }}
      ></CreationModal>
    </Suspense>
  );
};

export default Modals;
