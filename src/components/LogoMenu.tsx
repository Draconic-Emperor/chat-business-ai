import logo from "@/assets/logo.svg";
import { useNavigate } from "react-router";

/** Compact brand mark used in sidebar/mobile headers. */
export function LogoMenu() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate("/dashboard")}
      className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/15"
      aria-label="Go to dashboard"
    >
      <img src={logo} alt="Smart Hustle AI" className="size-5" />
    </button>
  );
}
