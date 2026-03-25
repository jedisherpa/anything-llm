let mockUploadImpl = (_request, _response, callback) => callback(null);

const mockSingle = jest.fn(
  () => (request, response, callback) =>
    mockUploadImpl(request, response, callback)
);
const mockMulter = jest.fn(() => ({
  single: mockSingle,
}));
mockMulter.diskStorage = jest.fn(() => ({}));

jest.mock("multer", () => mockMulter);
jest.mock("../../../utils/files", () => ({
  normalizePath: jest.fn((value) => value),
}));

const {
  handleFileUpload,
  handleAPIFileUpload,
} = require("../../../utils/files/multer");

function makeResponse() {
  const response = {
    status: jest.fn(() => response),
    json: jest.fn(() => response),
    end: jest.fn(() => response),
  };
  return response;
}

describe("multer upload middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUploadImpl = (_request, _response, callback) => callback(null);
  });

  it("returns a 400 when no file is present after upload handling", () => {
    const request = {};
    const response = makeResponse();
    const next = jest.fn();

    handleFileUpload(request, response, next);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      error: "No file uploaded.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("passes through when a file is uploaded successfully", () => {
    const request = { file: { originalname: "document.pdf" } };
    const response = makeResponse();
    const next = jest.fn();

    handleAPIFileUpload(request, response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).not.toHaveBeenCalled();
  });

  it("returns a 500 when multer reports an upload error", () => {
    mockUploadImpl = (_request, _response, callback) =>
      callback(new Error("disk full"));

    const request = {};
    const response = makeResponse();
    const next = jest.fn();

    handleFileUpload(request, response, next);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(response.json).toHaveBeenCalledWith({
      success: false,
      error: "Invalid file upload. disk full",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
