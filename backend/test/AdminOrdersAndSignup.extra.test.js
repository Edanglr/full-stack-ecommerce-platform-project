// Frontend/src/tests/AdminOrdersAndSignup.extra.test.js
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";

import AdminOrdersPage from "../components/AdminOrdersPage";
import SignupPage from "../components/SignupPage";

beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = jest.fn();
  localStorage.setItem("token", "tkn");
  window.print = jest.fn();
  window.alert = jest.fn();
});

afterEach(() => {
  localStorage.clear();
});

function mockFetchTextOnceOk(json) {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    text: async () => JSON.stringify(json),
  });
}
function mockFetchTextOnceFail(message = "Failed") {
  global.fetch.mockResolvedValueOnce({
    ok: false,
    status: 500,
    text: async () => JSON.stringify({ message }),
  });
}

// SignupPage uses res.json()
function mockFetchJsonOnceOk(json) {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => json,
  });
}
function mockFetchJsonOnceFail(json = { message: "Signup failed" }) {
  global.fetch.mockResolvedValueOnce({
    ok: false,
    json: async () => json,
  });
}

describe("EXTRA Frontend: AdminOrdersPage (6 tests)", () => {
  test("renders Sales Manager Panel and triggers initial invoices + products fetch", async () => {
    mockFetchTextOnceOk([]); // invoices
    mockFetchTextOnceOk([]); // products

    render(<AdminOrdersPage />);

    expect(await screen.findByText(/Sales Manager Panel/i)).toBeInTheDocument();

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    // basic endpoint checks
    expect(global.fetch.mock.calls[0][0]).toContain("/api/sales/invoices");
    expect(global.fetch.mock.calls[1][0]).toContain("/api/products");
  });

  test("invoices tab renders a row when invoices exist", async () => {
    mockFetchTextOnceOk([
      {
        _id: "inv1",
        totalAmount: 250,
        shippingStatus: "Shipped",
        trackingCode: "TRK",
        createdAt: new Date().toISOString(),
        user: { name: "Nisa" },
      },
    ]);
    mockFetchTextOnceOk([]); // products

    render(<AdminOrdersPage />);

    expect(await screen.findByText("inv1")).toBeInTheDocument();
    expect(screen.getByText(/Nisa/i)).toBeInTheDocument();
    expect(screen.getByText(/250\.00 TL/i)).toBeInTheDocument();
  });

  test("invoices fetch fail shows error box", async () => {
    mockFetchTextOnceFail("boom"); // invoices fail
    mockFetchTextOnceOk([]); // products (still called)

    render(<AdminOrdersPage />);

    expect(await screen.findByText(/boom/i)).toBeInTheDocument();
  });

  test("discount tab: clicking Apply Discount with no selection shows validation error", async () => {
    mockFetchTextOnceOk([]); // invoices
    mockFetchTextOnceOk([{ _id: "p1", name: "Hoodie", category: "Top", price: 100 }]); // products

    render(<AdminOrdersPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Discounts" }));

    // wait products table
    expect(await screen.findByText(/Hoodie/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Apply Discount/i }));

    expect(await screen.findByText(/Select at least 1 product/i)).toBeInTheDocument();
  });

  test("prices tab: Save Prices with no valid edits shows error", async () => {
    mockFetchTextOnceOk([]); // invoices
    mockFetchTextOnceOk([{ _id: "p1", name: "Hoodie", price: 100 }]); // products

    render(<AdminOrdersPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Prices" }));
    expect(await screen.findByText(/Set Product Prices/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Save Prices/i }));
    expect(await screen.findByText(/Enter at least 1 valid price/i)).toBeInTheDocument();
  });

  test("mail logs tab: loads logs and renders subject", async () => {
    mockFetchTextOnceOk([]); // invoices
    mockFetchTextOnceOk([]); // products
    mockFetchTextOnceOk([
      {
        at: new Date().toISOString(),
        to: "nisa@test.com",
        subject: "Discount Applied!",
        used: "discount",
        file: "mail-1.json",
      },
    ]); // mail logs after clicking tab

    render(<AdminOrdersPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Mail Logs" }));

    expect(await screen.findByText(/Mail Logs/i)).toBeInTheDocument();
    expect(await screen.findByText(/Discount Applied!/i)).toBeInTheDocument();

    // 3 fetch calls total: invoices + products + mail-logs
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
    expect(global.fetch.mock.calls[2][0]).toContain("/api/mail-logs");
  });
});

describe("EXTRA Frontend: SignupPage (4 tests)", () => {
  function renderSignup() {
    return render(
      <MemoryRouter initialEntries={["/signup"]}>
        <Routes>
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/login" element={<div>LOGIN PAGE</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  test("renders signup form fields", () => {
    renderSignup();
    expect(screen.getByText(/Sign Up/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Full Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
  });

  test("successful signup navigates to /login and alerts", async () => {
    mockFetchJsonOnceOk({ message: "ok" });

    renderSignup();

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Nisa" } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "nisa@test.com" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "123456" } });

    fireEvent.click(screen.getByRole("button", { name: /Sign Up/i }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
    expect(window.alert).toHaveBeenCalled();

    expect(await screen.findByText("LOGIN PAGE")).toBeInTheDocument();
  });

  test("server error shows message", async () => {
    mockFetchJsonOnceFail({ message: "Email already used" });

    renderSignup();

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Nisa" } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "nisa@test.com" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "123456" } });

    fireEvent.click(screen.getByRole("button", { name: /Sign Up/i }));

    expect(await screen.findByText(/Email already used/i)).toBeInTheDocument();
  });

  test("network error shows Network error", async () => {
    global.fetch.mockRejectedValueOnce(new Error("net down"));

    renderSignup();

    fireEvent.change(screen.getByLabelText(/Full Name/i), { target: { value: "Nisa" } });
    fireEvent.change(screen.getByLabelText(/Email/i), { target: { value: "nisa@test.com" } });
    fireEvent.change(screen.getByLabelText(/Password/i), { target: { value: "123456" } });

    fireEvent.click(screen.getByRole("button", { name: /Sign Up/i }));

    expect(await screen.findByText(/Network error/i)).toBeInTheDocument();
  });
});
