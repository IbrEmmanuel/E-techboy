export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex h-40 flex-col items-center justify-center gap-3 text-center">
      <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
      {onRetry ? (
        <button type="button" className="text-sm underline" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
