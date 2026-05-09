interface Props {
  message: string;
}

export function ErrorBanner({ message }: Props): JSX.Element {
  return (
    <div className="error-banner" role="alert" data-testid="error-banner">
      {message}
    </div>
  );
}
