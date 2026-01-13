import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import AdminDeliveriesPage from "../components/AdminDeliveriesPage";

beforeEach(() => {
  jest.resetAllMocks();
  global.fetch = jest.fn();
  localStorage.setItem("token", "tkn");
  window.confirm = jest.fn(() => true);
});

afterEach(() => {
  localStorage.clear();
});

function mockFetchOnceOk(json) {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    text: async () => JSON.stringify(json),
  });
}

function mockFetchOnceFail(message = "Failed") {
  global.fetch.mockResolvedValueOnce({
    ok: false,
    status: 500,
    text: async () => JSON.stringify({ message }),
  });
}

describe("AdminDeliveriesPage", () => {
  test("loads deliveries and renders grouped rows", async () => {
    mockFetchOnceOk([
      {
        deliveryId: "D1",
        customerId: "C1",
        customerName: "Nisa",
        deliveryAddress: "Address 1",
        trackingCode: "TRK1",
        shippingStatus: "Processing",
        createdAt: new Date().toISOString(),
        productId: "P1",
        productName: "Hoodie",
        quantity: 2,
        totalPrice: 200,
      },
      {
        deliveryId: "D1",
        customerId: "C1",
        customerName: "Nisa",
        deliveryAddress: "Address 1",
        trackingCode: "TRK1",
        shippingStatus: "Processing",
        createdAt: new Date().toISOString(),
        productId: "P2",
        productName: "Jeans",
        quantity: 1,
        totalPrice: 300,
      },
    ]);

    render(<AdminDeliveriesPage />);

    expect(await screen.findByText("Delivery / Order Status Panel")).toBeInTheDocument();
    // grouped -> Delivery ID cell shows D1
    expect(await screen.findByText("D1")).toBeInTheDocument();
    // items detail includes both product ids
    expect(screen.getByText(/P1 \| qty: 2 \| total: 200\.00/i)).toBeInTheDocument();
    expect(screen.getByText(/P2 \| qty: 1 \| total: 300\.00/i)).toBeInTheDocument();
  });

  test("shows error when API fails", async () => {
    mockFetchOnceFail("boom");
    render(<AdminDeliveriesPage />);

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    expect(await screen.findByText(/boom/i)).toBeInTheDocument();
  });

  test("filters by status", async () => {
    mockFetchOnceOk([
      {
        deliveryId: "D1",
        customerId: "C1",
        customerName: "A",
        deliveryAddress: "X",
        trackingCode: "T",
        shippingStatus: "Processing",
        createdAt: new Date().toISOString(),
        productId: "P1",
        productName: "Hoodie",
        quantity: 1,
        totalPrice: 100,
      },
      {
        deliveryId: "D2",
        customerId: "C2",
        customerName: "B",
        deliveryAddress: "Y",
        trackingCode: "T2",
        shippingStatus: "Delivered",
        createdAt: new Date().toISOString(),
        productId: "P2",
        productName: "Jeans",
        quantity: 1,
        totalPrice: 200,
      },
    ]);

    render(<AdminDeliveriesPage />);

    expect(await screen.findByText("D1")).toBeInTheDocument();
    expect(await screen.findByText("D2")).toBeInTheDocument();

    fireEvent.change(screen.getByDisplayValue("All"), { target: { value: "Delivered" } });

    // D1 should disappear, D2 should remain
    await waitFor(() => {
      expect(screen.queryByText("D1")).not.toBeInTheDocument();
      expect(screen.getByText("D2")).toBeInTheDocument();
    });
  });

  test("update status calls PUT endpoint and reloads", async () => {
    // initial load
    mockFetchOnceOk([
      {
        deliveryId: "D1",
        customerId: "C1",
        customerName: "A",
        deliveryAddress: "X",
        trackingCode: "T",
        shippingStatus: "Processing",
        createdAt: new Date().toISOString(),
        productId: "P1",
        productName: "Hoodie",
        quantity: 1,
        totalPrice: 100,
      },
    ]);

    // PUT response
    mockFetchOnceOk({ message: "Order status updated." });

    // reload after update
    mockFetchOnceOk([
      {
        deliveryId: "D1",
        customerId: "C1",
        customerName: "A",
        deliveryAddress: "X",
        trackingCode: "T",
        shippingStatus: "Delivered",
        createdAt: new Date().toISOString(),
        productId: "P1",
        productName: "Hoodie",
        quantity: 1,
        totalPrice: 100,
      },
    ]);

    render(<AdminDeliveriesPage />);
    expect(await screen.findByText("D1")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Delivered"));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/orders/D1/status"),
        expect.objectContaining({ method: "PUT" })
      );
    });
  });
});
