import { render, screen } from "@testing-library/react";
import LoginPage from "../src/components/LoginPage";
import { BrowserRouter } from "react-router-dom";

test("LoginPage renders email and password fields", () => {
  render(
    <BrowserRouter>
      <LoginPage />
    </BrowserRouter>
  );

  expect(screen.getByLabelText(/Email address/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
});
