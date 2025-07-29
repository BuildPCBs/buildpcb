interface ProjectItemProps {
  name: string;
  onClick?: () => void;
  isCollapsed?: boolean;
}

export function ProjectItem({
  name,
  onClick,
  isCollapsed = false,
}: ProjectItemProps) {
  return (
    <div
      className="flex items-center justify-between py-2 px-3 hover:bg-gray-50 cursor-pointer rounded-md transition-colors"
      onClick={onClick}
    >
      <span className="text-sm text-gray-700 font-medium">{name}</span>
      <span className="text-gray-400 text-lg">{isCollapsed ? "..." : "›"}</span>
    </div>
  );
}
