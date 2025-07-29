export function DeviceRestriction() {
  return (
    <div className="flex lg:hidden min-h-screen items-center justify-center bg-white p-8">
      <div className="text-center space-y-6 max-w-md">
        <div className="text-6xl">💻</div>
        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-gray-900">Desktop Required</h1>
          <p className="text-gray-600 leading-relaxed">
            BuildPCB.ai IDE requires a desktop or laptop computer with a minimum
            screen width of 1024px for optimal circuit design experience.
          </p>
          <p className="text-sm text-gray-500">
            Please access this application from a larger screen.
          </p>
        </div>
      </div>
    </div>
  );
}
