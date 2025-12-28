class Glooit < Formula
  desc "Sync AI coding assistant configurations across Claude, Cursor, OpenCode, Codex"
  homepage "https://github.com/nikuscs/glooit"
  version "0.6.1"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/nikuscs/glooit/releases/download/v#{version}/glooit-darwin-arm64"
      sha256 "PLACEHOLDER_ARM64_SHA256" # arm64
    end
    on_intel do
      url "https://github.com/nikuscs/glooit/releases/download/v#{version}/glooit-darwin-x64"
      sha256 "PLACEHOLDER_X64_SHA256" # x64
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/nikuscs/glooit/releases/download/v#{version}/glooit-linux-x64"
      sha256 "PLACEHOLDER_LINUX_SHA256" # linux
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
