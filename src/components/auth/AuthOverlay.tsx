import { useState, useRef } from "react";
import { r, responsive } from "@/lib/responsive";
import { useAuth } from "@/hooks/useAuth";

interface AuthOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface AuthFormProps {
  onBack?: () => void;
  onSuccess?: (email?: string) => void;
  email?: string;
}

function EmailEntryForm({ onSuccess }: Pick<AuthFormProps, "onSuccess">) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { signInWithOtp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const { error } = await signInWithOtp(email);
      if (error) {
        setError(error.message || "Failed to send verification code");
        console.error("Failed to send OTP:", error);
      } else {
        onSuccess?.(email);
      }
    } catch (error: any) {
      setError("Failed to send verification code");
      console.error("Failed to send code:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="bg-white border border-[#A6A6A6] relative"
      style={{
        ...r({
          width: 331,
          height: 289,
          borderRadius: 20,
        }),
      }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
        {/* Title */}
        <h2
          className="text-center font-medium mb-2"
          style={{
            fontSize: responsive(15),
            color: "#555555",
          }}
        >
          Welcome to BuildPCBs
        </h2>

        {/* Subtitle */}
        <p
          className="text-center mb-6"
          style={{
            fontSize: responsive(14),
            color: "#999999",
          }}
        >
          Continue with our passwordless signin
        </p>

        {/* Email Form */}
        <form
          onSubmit={handleSubmit}
          className="w-full flex flex-col items-center"
        >
          {/* Email Input */}
          <input
            type="email"
            placeholder="enter your mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="border border-[#DDDDDD] rounded-lg focus:outline-none focus:border-[#0038DF] focus:ring-1 focus:ring-[#0038DF]/20 transition-colors"
            style={{
              ...r({
                width: 289,
                height: 34,
                borderRadius: 8,
                padding: 10,
              }),
              background: "#FAFAFAF2",
              fontSize: responsive(12),
            }}
            disabled={isLoading}
            required
          />

          {/* Error Message */}
          {error && (
            <div
              className="mt-2 text-red-500 text-center"
              style={{
                fontSize: responsive(10),
                maxWidth: responsive(289),
              }}
            >
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!email.trim() || isLoading}
            className="mt-4 bg-[#0038DF] text-white rounded-lg hover:bg-[#002BB5] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            style={{
              ...r({
                width: 289,
                height: 34,
                borderRadius: 8,
              }),
              fontSize: responsive(12),
            }}
          >
            {isLoading ? "Sending..." : "Continue"}
          </button>
        </form>
      </div>

      {/* Terms Text - Positioned at bottom of container */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center">
        <p
          className="text-center"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: responsive(8),
            lineHeight: "120%",
            letterSpacing: "-0.5%",
            color: "#999999",
            ...r({ width: 133 }),
          }}
        >
          By creating an account, you agree to our{" "}
          <span className="text-[#0038DF]">Terms</span>.
        </p>
      </div>
    </div>
  );
}

function CodeVerificationForm({ onBack, onSuccess, email }: AuthFormProps) {
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { verifyOtp } = useAuth();

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) return; // Only allow single digit

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      // Focus previous input on backspace
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const codeString = code.join("");
    if (codeString.length !== 6 || !email) return;

    setIsLoading(true);
    setError(null);

    try {
      const { error } = await verifyOtp(email, codeString);
      if (error) {
        setError(error.message || "Invalid verification code");
        console.error("Failed to verify OTP:", error);
      } else {
        onSuccess?.();
      }
    } catch (error: any) {
      setError("Failed to verify code");
      console.error("Failed to verify code:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="bg-white border border-[#A6A6A6] relative"
      style={{
        ...r({
          width: 331,
          height: 346,
          borderRadius: 20,
        }),
      }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6">
        {/* Title */}
        <h2
          className="text-center font-medium mb-2"
          style={{
            fontSize: responsive(15),
            color: "#555555",
          }}
        >
          Confirm Code
        </h2>

        {/* Subtitle */}
        <p
          className="text-center mb-6"
          style={{
            fontSize: responsive(14),
            color: "#999999",
          }}
        >
          enter a 6-digit code sent to your mail
        </p>

        {/* Code Form */}
        <form
          onSubmit={handleSubmit}
          className="w-full flex flex-col items-center"
        >
          {/* 6 Separate Code Input Boxes - Grouped Layout */}
          <div
            className="flex justify-center mb-4"
            style={{ gap: responsive(24) }}
          >
            {/* First group of 3 boxes */}
            <div className="flex" style={{ gap: responsive(8) }}>
              {code.slice(0, 3).map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]"
                  maxLength={1}
                  value={digit}
                  onChange={(e) =>
                    handleCodeChange(index, e.target.value.replace(/\D/g, ""))
                  }
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="text-center border focus:outline-none focus:border-[#0038DF] focus:ring-1 focus:ring-[#0038DF]/20 text-gray-900 transition-colors"
                  style={{
                    fontSize: responsive(16),
                    width: responsive(36),
                    height: responsive(36),
                    borderRadius: responsive(8),
                    border: `${responsive(1)} solid #dddddd`,
                    background: "#F9F9F9F2",
                  }}
                  disabled={isLoading}
                />
              ))}
            </div>

            {/* Second group of 3 boxes */}
            <div className="flex" style={{ gap: responsive(8) }}>
              {code.slice(3, 6).map((digit, index) => (
                <input
                  key={index + 3}
                  ref={(el) => {
                    inputRefs.current[index + 3] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]"
                  maxLength={1}
                  value={digit}
                  onChange={(e) =>
                    handleCodeChange(
                      index + 3,
                      e.target.value.replace(/\D/g, "")
                    )
                  }
                  onKeyDown={(e) => handleKeyDown(index + 3, e)}
                  className="text-center border focus:outline-none focus:border-[#0038DF] focus:ring-1 focus:ring-[#0038DF]/20 text-gray-900 transition-colors"
                  style={{
                    fontSize: responsive(16),
                    width: responsive(36),
                    height: responsive(36),
                    borderRadius: responsive(8),
                    border: `${responsive(1)} solid #dddddd`,
                    background: "#F9F9F9F2",
                  }}
                  disabled={isLoading}
                />
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div
              className="mt-2 text-red-500 text-center"
              style={{
                fontSize: responsive(10),
                maxWidth: responsive(272),
              }}
            >
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={code.join("").length !== 6 || isLoading}
            className="mt-4 bg-[#0038DF] text-white rounded-lg hover:bg-[#002BB5] disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            style={{
              ...r({
                width: 272,
                height: 34,
                borderRadius: 8,
              }),
              fontSize: responsive(12),
            }}
          >
            {isLoading ? "Verifying..." : "Verify Code"}
          </button>

          {/* Back Button */}
          {/*           </button>

          {/* Back Button */}
          {/* <button
            type="button"
            onClick={onBack}
            className="mt-2 text-gray-600 hover:text-gray-800 transition-colors"
            style={{ fontSize: responsive(12) }}
            disabled={isLoading}
          >
            Back to email
          </button> */}
        </form>
      </div>

      {/* Terms Text - Positioned at bottom of container */}
      <div className="absolute bottom-4 left-0 right-0 flex justify-center">
        <p
          className="text-center"
          style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: responsive(8),
            lineHeight: "120%",
            letterSpacing: "-0.5%",
            color: "#999999",
            ...r({ width: 133 }),
          }}
        >
          By creating an account, you agree to our{" "}
          <span className="text-[#0038DF]">Terms</span>.
        </p>
      </div>
    </div>
  );
}

export function AuthOverlay({ isOpen, onClose, onSuccess }: AuthOverlayProps) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");

  if (!isOpen) return null;

  const handleEmailSuccess = (userEmail?: string) => {
    if (userEmail) {
      setEmail(userEmail);
      setStep("code");
    }
  };

  const handleCodeSuccess = () => {
    onSuccess?.();
    onClose();
    setStep("email"); // Reset for next time
    setEmail(""); // Clear email
  };

  const handleBack = () => {
    setStep("email");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop with blur - no black overlay, just blur */}
      <div
        className="absolute inset-0 backdrop-blur-sm"
        onClick={onClose}
        style={{ backgroundColor: "rgba(255, 255, 255, 0.1)" }}
      />

      {/* Auth Form */}
      <div className="relative z-10">
        {step === "email" ? (
          <EmailEntryForm onSuccess={handleEmailSuccess} />
        ) : (
          <CodeVerificationForm
            email={email}
            onBack={handleBack}
            onSuccess={handleCodeSuccess}
          />
        )}
      </div>
    </div>
  );
}
