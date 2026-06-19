import { SandboxEntryScreen } from '../../../src/components/sandbox/SandboxEntryScreen';
import { SandboxWorkbench } from '../../../src/components/sandbox/SandboxWorkbench';
import { useSandboxStore } from '../../../src/store/sandbox';

export default function SandboxTabScreen() {
  const entryLayer = useSandboxStore((s) => s.entryLayer);

  if (entryLayer === 'workbench') {
    return <SandboxWorkbench />;
  }

  return <SandboxEntryScreen />;
}
