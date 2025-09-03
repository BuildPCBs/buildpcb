import { responsiveFontSize } from "@/lib/responsive";

export function DeviceRestriction() {
  return (
    <div className="flex lg:hidden min-h-screen items-center justify-center bg-white p-8">
      <div className="text-center space-y-6 max-w-md">
        <div style={{ fontSize: responsiveFontSize(64) }}>💻</div>
        <div className="space-y-3">
          <h1
            className="font-bold text-gray-900"
            style={{ fontSize: responsiveFontSize(32) }}
          >
            Desktop Required
          </h1>
          <p
            className="text-gray-600 leading-relaxed"
            style={{ fontSize: responsiveFontSize(16) }}
          >
            BuildPCBs IDE requires a desktop or laptop computer with a minimum
            screen width for optimal circuit design experience.
          </p>
          <p
            className="text-gray-500"
            style={{ fontSize: responsiveFontSize(14) }}
          >
            Please access this application from a larger screen.
          </p>
        </div>
      </div>
    </div>
  );
}
