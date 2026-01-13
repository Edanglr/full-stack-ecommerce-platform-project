import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AdminReturnsPage from "../components/AdminReturnsPage";

beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = jest.fn();
  localStorage.setItem("token", "tkn");
  window.confirm = jest.fn(() => true);
  window.prompt = jest.fn(() => "reason");
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

describe("AdminReturnsPage", () => {
  test("loads returns and renders list", async () => {
    mockFetchTextOnceOk([
      {
        _id: "r1",
        createdAt: new Date().toISOString(),
        status: "Requested",
        quantity: 1,
        reason: "No fit",
        user: { name: "Nisa", email: "nisa@test.com" },
        order: { _id: "o1" },
        product: { _id: "p1", name: "Hoodie" },
      },
    ]);

    render(<AdminReturnsPage />);
    expect(await screen.findByText(/Return Requests/i)).toBeInTheDocument();
    expect(await screen.findByText(/Hoodie/i)).toBeInTheDocument();

    // ✅ "Requested" hem select option hem badge => getAllByText kullan
    const requested = screen.getAllByText(/Requested/i);
    expect(requested.length).toBeGreaterThan(0);
  });

  test("shows error on fetch fail", async () => {
    mockFetchTextOnceFail("boom");
    render(<AdminReturnsPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(await screen.findByText(/boom/i)).toBeInTheDocument();
  });

  test("approve button triggers PATCH", async () => {
    // initial load
    mockFetchTextOnceOk([
      {
        _id: "r1",
        createdAt: new Date().toISOString(),
        status: "Requested",
        quantity: 1,
        reason: "No fit",
        user: { name: "Nisa", email: "nisa@test.com" },
        order: { _id: "o1" },
        product: { _id: "p1", name: "Hoodie" },
      },
    ]);

    // approve response
    mockFetchTextOnceOk({ message: "Return approved" });

    // sync list fetch after approve
    mockFetchTextOnceOk([
      {
        _id: "r1",
        createdAt: new Date().toISOString(),
        status: "Approved",
        quantity: 1,
        reason: "No fit",
        user: { name: "Nisa", email: "nisa@test.com" },
        order: { _id: "o1" },
        product: { _id: "p1", name: "Hoodie" },
      },
    ]);

    render(<AdminReturnsPage />);
    expect(await screen.findByText(/Hoodie/i)).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Approve" })[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/sales/returns/r1/approve"),
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });
});
