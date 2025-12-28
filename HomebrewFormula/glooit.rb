class Glooit < Formula
  desc "Sync AI coding assistant configurations across Claude, Cursor, OpenCode, Codex"
  homepage "https://github.com/nikuscs/glooit"
  version "0.6.2"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/nikuscs/glooit/releases/download/v#{version}/glooit-darwin-arm64"
      sha256 "c68adf8c0135c3278212049161519107d877429e42fd6d663dc717fddaf1432c" # arm64
    end
    on_intel do
      url "https://github.com/nikuscs/glooit/releases/download/v#{version}/glooit-darwin-x64"
      sha256 "edfcdbea84d31a6c7de500acc981bc0a527289979ff4aa41088e152d86a7b785" # x64
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/nikuscs/glooit/releases/download/v#{version}/glooit-linux-x64"
      sha256 "bec0d4738fdb62df1ff606dd5b322201282b797faaf6fb9f2c7991b65d7d0acf" # linux
    end
  end

  def install
    if OS.mac? && Hardware::CPU.arm?
      bin.install "glooit-darwin-arm64" => "glooit"
    elsif OS.mac? && Hardware::CPU.intel?
      bin.install "glooit-darwin-x64" => "glooit"
    elsif OS.linux?
      bin.install "glooit-linux-x64" => "glooit"
    end
  end

  test do
    assert_match "glooit", shell_output("#{bin}/glooit --version")
  end
end
