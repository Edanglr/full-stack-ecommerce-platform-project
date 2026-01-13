// Frontend/src/tests/AdminOrdersAndSignup.extra.test.js
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import AdminOrdersPage from "../components/AdminOrdersPage";
import SignupPage from "../components/SignupPage";

// küçük helper: fetch mock
function mockFetchOnceJson(ok, json) {
  global.fetch = jest.fn().mockResolvedValueOnce({
    ok,
    text: async () => JSON.stringify(json),
    json: async () => json,
  });
}

describe("EXTRA: AdminOrdersPage + SignupPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // localStorage token çağrısı olmasın diye
    jest.spyOn(window.localStorage.__proto__, "getItem").mockReturnValue("testtoken");
  });

  afterEach(() => {
    window.localStorage.getItem.mockRestore?.();
  });

  test("AdminOrdersPage renders + initial fetches are called", async () => {
    // useEffect: invoices + products fetch
    mockFetchOnceJson(true, []); // invoices
    mockFetchOnceJson(true, []); // products

    render(
      <MemoryRouter>
        <AdminOrdersPage />
      </MemoryRouter>
    );

    expect(await screen.findByText(/Sales Manager Panel/i)).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  });

  test("SignupPage shows error on failed signup", async () => {
    mockFetchOnceJson(false, { message: "Signup failed" });

    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/enter your name/i), { target: { value: "Nisa" } });
    fireEvent.change(screen.getByPlaceholderText(/enter email/i), { target: { value: "nisa@test.com" } });
    fireEvent.change(screen.getByPlaceholderText(/enter password/i), { target: { value: "123456" } });

    fireEvent.click(screen.getByRole("button", { name: /sign up/i }));

    expect(await screen.findByText(/signup failed/i)).toBeInTheDocument();
  });
});
