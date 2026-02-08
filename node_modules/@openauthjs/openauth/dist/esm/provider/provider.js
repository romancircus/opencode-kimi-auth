// src/provider/provider.ts
class ProviderError extends Error {
}

class ProviderUnknownError extends ProviderError {
}
export {
  ProviderUnknownError,
  ProviderError
};
