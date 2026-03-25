jest.mock("../../utils/prisma", () => ({
  desktop_mobile_devices: {
    create: jest.fn(),
    findFirst: jest.fn(),
  },
}));

const prisma = require("../../utils/prisma");
const { MobileDevice } = require("../../models/mobileDevice");

describe("MobileDevice.create", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("normalizes device OS casing before validation and persistence", async () => {
    prisma.desktop_mobile_devices.create.mockResolvedValue({
      id: 1,
      deviceOs: "ios",
      deviceName: "Paul's iPhone",
      token: "token",
      userId: 42,
    });

    const result = await MobileDevice.create({
      deviceOs: "iOS",
      deviceName: "Paul's iPhone",
      userId: 42,
    });

    expect(result.error).toBeNull();
    expect(prisma.desktop_mobile_devices.create).toHaveBeenCalledWith({
      data: {
        deviceName: "Paul's iPhone",
        deviceOs: "ios",
        token: expect.any(String),
        userId: 42,
      },
    });
  });

  it("rejects unsupported device OS values", async () => {
    const result = await MobileDevice.create({
      deviceOs: "windows-phone",
      deviceName: "Unsupported",
    });

    expect(result).toEqual({
      device: null,
      error: "Invalid device OS - windows-phone",
    });
    expect(prisma.desktop_mobile_devices.create).not.toHaveBeenCalled();
  });

  it("returns null when the device lookup fails", async () => {
    prisma.desktop_mobile_devices.findFirst.mockRejectedValue(
      new Error("database unavailable")
    );

    await expect(MobileDevice.get({ token: "abc" })).resolves.toBeNull();
  });
});
