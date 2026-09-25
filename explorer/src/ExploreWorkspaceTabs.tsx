import { useTranslation } from 'react-i18next';

export type ExploreView = 'graph' | 'memories' | 'vocabulary';

type ExploreWorkspaceTabsProps = {
  activeView: ExploreView;
  agentMemoryAvailable: boolean;
  onSelect: (view: ExploreView) => void;
};

export function ExploreWorkspaceTabs({
  activeView,
  agentMemoryAvailable,
  onSelect,
}: ExploreWorkspaceTabsProps) {
  const { t } = useTranslation();
  return (
    <>
      <button className="workspace-tab" data-active={activeView === 'graph'} onClick={() => onSelect('graph')}>
        {t('workspace.explore.tabGraph')}
      </button>
      {agentMemoryAvailable ? (
        <button className="workspace-tab" data-active={activeView === 'memories'} onClick={() => onSelect('memories')}>
          {t('workspace.explore.tabMemories')}
        </button>
      ) : null}
      <button className="workspace-tab" data-active={activeView === 'vocabulary'} onClick={() => onSelect('vocabulary')}>
        {t('workspace.explore.tabVocabulary')}
      </button>
    </>
  );
}
