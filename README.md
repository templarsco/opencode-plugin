# @lightweight-ai/opencode-plugin

The @lightweight-ai/opencode-plugin connects the OpenCode CLI to the Lightweight AI API gateway. It provides seamless access to a wide range of large language models through a single unified interface.

## Description

This plugin integrates the Lightweight AI API (api.lightweight.one) into OpenCode, allowing users to leverage over 50 models including GPT-5, Claude Opus 4.6, and Gemini. It handles model discovery, capability mapping, and authentication automatically.

## Installation

Install the package via npm:

```bash
npm install @lightweight-ai/opencode-plugin
```

## Getting an API Key

To use this plugin, you must register at the Lightweight AI platform to obtain an API key. Your API key should follow the format `lw_sk_...`.

## Configuration

The plugin requires the `LIGHTWEIGHT_API_KEY` environment variable to be set.

```bash
export LIGHTWEIGHT_API_KEY=lw_sk_your_api_key_here
```

## Usage

Once installed and configured, OpenCode will automatically detect the "lightweight" provider. The plugin fetches available models from the API and caches them for one hour.

Reasoning models automatically include effort level variants:
- low
- medium
- high
- xhigh

## How it Works

The plugin implements two primary hooks:
- **config**: Registers the "lightweight" provider using `@ai-sdk/openai` as the underlying SDK. It points to `https://api.lightweight.one/v1` and maps models based on their reported capabilities (tool calling, attachments, reasoning).
- **chat.headers**: Adds `X-Client: opencode` and `X-Plugin-Version: 1.0.0` headers to all outgoing requests for better telemetry and support.

Model discovery is performed by fetching `/v1/models` with the provided Bearer token. The plugin maps technical constraints such as context and output limits automatically.

## License

MIT
