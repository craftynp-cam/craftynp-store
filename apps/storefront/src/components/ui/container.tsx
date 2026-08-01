export type ContainerProps = {
  padded?: boolean;
  className?: string;
  children?: React.ReactNode;
};

export function Container({
  padded = true,
  className,
  children,
}: ContainerProps) {
  const padding = padded ? "px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12" : "";

  return (
    <div
      className={`mx-auto w-full max-w-page xl:max-w-page-xl 2xl:max-w-page-2xl ${padding} ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
