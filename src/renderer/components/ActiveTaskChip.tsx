import { useActiveTask, formatElapsed } from '../hooks/useActiveTask';

interface ActiveTaskChipProps {
  onClick?: () => void;
}

export function ActiveTaskChip({ onClick }: ActiveTaskChipProps) {
  const { task, settings, elapsedSeconds, hasTask, hasTimer } = useActiveTask();

  // Don't show if disabled or no task
  if (!settings?.showInBrainBar || !hasTask || !task) {
    return null;
  }

  // Truncate title if too long
  const maxTitleLength = 20;
  const displayTitle = task.title.length > maxTitleLength
    ? task.title.substring(0, maxTitleLength) + '...'
    : task.title;

  return (
    <button className="active-task-chip" onClick={onClick} title={task.title}>
      <div className="active-task-content">
        <span className="active-task-title">{displayTitle}</span>
        {settings.showProject && task.project && (
          <span className="active-task-project">{task.project.name}</span>
        )}
      </div>
      {hasTimer && (
        <div className="active-task-timer">
          <span className="timer-dot recording" />
          <span className="timer-value">{formatElapsed(elapsedSeconds)}</span>
        </div>
      )}
    </button>
  );
}

export default ActiveTaskChip;
