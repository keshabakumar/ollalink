// Native Windows input injection for the Ollalink agent.
// Calls Win32 SendInput directly — no process spawn, no Add-Type, no PowerShell.
// Latency: <1ms per event (a single syscall into user32.dll).
//
// Exposes two functions:
//   injectMouse(dx, dy, flags)   — dx,dy are absolute 0..65535; flags is MOUSEEVENTF_* OR'd
//   injectKey(vk, flags)          — vk is a virtual key code; flags is KEYEVENTF_* OR'd
//
// Returns true on success, false on SendInput failure. Throws JS Error on bad args.

#include <napi.h>
#include <windows.h>
#include <string>

// SendInput with one INPUT. Returns true if SendInput reported 1 event inserted.
static bool SendOneInput(INPUT& input) {
  UINT sent = SendInput(1, &input, sizeof(INPUT));
  return sent == 1;
}

Napi::Value InjectMouse(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 3 ||
      !info[0].IsNumber() || !info[1].IsNumber() || !info[2].IsNumber()) {
    Napi::TypeError::New(env, "injectMouse(dx, dy, flags) expects 3 numbers")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  INPUT input = {};
  input.type = INPUT_MOUSE;
  input.mi.dx = static_cast<LONG>(info[0].As<Napi::Number>().Int32Value());
  input.mi.dy = static_cast<LONG>(info[1].As<Napi::Number>().Int32Value());
  input.mi.dwFlags = static_cast<DWORD>(info[2].As<Napi::Number>().Uint32Value());
  input.mi.time = 0;
  input.mi.dwExtraInfo = 0;

  return Napi::Boolean::New(env, SendOneInput(input));
}

Napi::Value InjectKey(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  if (info.Length() < 2 ||
      !info[0].IsNumber() || !info[1].IsNumber()) {
    Napi::TypeError::New(env, "injectKey(vk, flags) expects 2 numbers")
        .ThrowAsJavaScriptException();
    return env.Undefined();
  }

  INPUT input = {};
  input.type = INPUT_KEYBOARD;
  input.ki.wVk = static_cast<WORD>(info[0].As<Napi::Number>().Uint32Value());
  input.ki.wScan = 0;
  input.ki.dwFlags = static_cast<DWORD>(info[1].As<Napi::Number>().Uint32Value());
  input.ki.time = 0;
  input.ki.dwExtraInfo = 0;

  return Napi::Boolean::New(env, SendOneInput(input));
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "injectMouse"), Napi::Function::New(env, InjectMouse));
  exports.Set(Napi::String::New(env, "injectKey"), Napi::Function::New(env, InjectKey));
  return exports;
}

NODE_API_MODULE(input_addon, Init)