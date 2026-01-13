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

function okResponse(data) {
  return {
    ok: true,
    // bazı component’ler json(), bazıları text() kullanıyor olabilir → ikisini de ver
    json: async () => data,
    text: async () => JSON.stringify(data),
  };
}

function failResponse(message = "Failed") {
  return {
    ok: false,
    status: 500,
    json: async () => ({ message }),
    text: async () => JSON.stringify({ message }),
  };
}

describe("AdminReturnsPage", () => {
  test("loads returns and renders list", async () => {
    const list = [
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
    ];

    global.fetch.mockResolvedValueOnce(okResponse(list));

    render(<AdminReturnsPage />);
    expect(await screen.findByText(/Return Requests/i)).toBeInTheDocument();
    expect(await screen.findByText(/Hoodie/i)).toBeInTheDocument();

    // ✅ "Requested" hem select option hem badge olabilir
    const requested = screen.getAllByText(/Requested/i);
    expect(requested.length).toBeGreaterThan(0);
  });

  test("shows error on fetch fail", async () => {
    global.fetch.mockResolvedValueOnce(failResponse("boom"));

    render(<AdminReturnsPage />);
    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(await screen.findByText(/boom/i)).toBeInTheDocument();
  });

  test("approve button triggers PATCH", async () => {
    const requestedList = [
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
    ];

    const approvedList = [
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
    ];

    // ✅ Sıra bağımlılığını kaldır → URL’e göre cevap dön
    let afterApprove = false;
    global.fetch.mockImplementation((url, options = {}) => {
      const u = String(url);
      const method = (options.method || "GET").toUpperCase();

      // approve endpoint
      if (u.includes("/api/sales/returns/r1/approve") && method === "PATCH") {
        afterApprove = true;
        return Promise.resolve(okResponse({ message: "Return approved" }));
      }

      // returns list endpoint (approve öncesi / sonrası)
      if (u.includes("/api/sales/returns") && !u.includes("/approve")) {
        return Promise.resolve(okResponse(afterApprove ? approvedList : requestedList));
      }

      // component başka endpoint çağırıyorsa (stats vs) boş dön, test bozulmasın
      return Promise.resolve(okResponse({}));
    });

    render(<AdminReturnsPage />);

    // ✅ önce list render olsun
    expect(await screen.findByText(/Hoodie/i)).toBeInTheDocument();

    const approveButtons = await screen.findAllByRole("button", { name: "Approve" });
    fireEvent.click(approveButtons[0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/sales/returns/r1/approve"),
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });
});
