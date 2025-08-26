export const handleProgressBarInteraction = (
  event: any,
  currentPlayerInstanceRef: React.MutableRefObject<any>,
  duration: number,
  progressBarRef: React.MutableRefObject<HTMLDivElement | null>,
  setProgress: (progress: number) => void
) => {
  const currentPlayer = currentPlayerInstanceRef.current;
  if (!currentPlayer || duration <= 0) return;

  const progressBar = progressBarRef.current;
  if (!progressBar) return;

  const rect = progressBar.getBoundingClientRect();
  const clickX = event.clientX - rect.left;
  const progressBarWidth = rect.width;
  const clickProgress = Math.max(0, Math.min(100, (clickX / progressBarWidth) * 100));
  
  const seekTime = (clickProgress / 100) * duration;
  
  console.log('🎬 Seeking to:', {
    clickProgress: clickProgress.toFixed(2),
    seekTime: seekTime.toFixed(2),
    duration: duration.toFixed(2)
  });
  
  currentPlayer.seek(seekTime);
  setProgress(clickProgress);
};

export const handleProgressBarMouseDown = (
  event: any,
  progress: number,
  setIsDragging: (dragging: boolean) => void,
  setDragProgress: (progress: number) => void,
  progressBarRef: React.MutableRefObject<HTMLDivElement | null>,
  handleProgressBarInteraction: (event: any) => void
) => {
  setIsDragging(true);
  setDragProgress(progress);
  handleProgressBarInteraction(event);
  
  const handleMouseMove = (moveEvent: any) => {
    if (!progressBarRef.current) return;
    
    const rect = progressBarRef.current.getBoundingClientRect();
    const moveX = moveEvent.clientX - rect.left;
    const progressBarWidth = rect.width;
    const moveProgress = Math.max(0, Math.min(100, (moveX / progressBarWidth) * 100));
    
    setDragProgress(moveProgress);
  };
  
  const handleMouseUp = (upEvent: any) => {
    setIsDragging(false);
    handleProgressBarInteraction(upEvent);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
};