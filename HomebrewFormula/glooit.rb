class Glooit < Formula
  desc "Sync AI coding assistant configurations across Claude, Cursor, OpenCode, Codex"
  homepage "https://github.com/nikuscs/glooit"
  version "0.6.4"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/nikuscs/glooit/releases/download/v#{version}/glooit-darwin-arm64"
      sha256 "f0952a0cd28b8beb148f67b8f889d99cb1bd716af8f8c3ee6aeab4255437bc1c" # arm64
    end
    on_intel do
      url "https://github.com/nikuscs/glooit/releases/download/v#{version}/glooit-darwin-x64"
      sha256 "00ca89e62fb13a6152bff5987564d2f86174bb30385d9eec2f1c6c1ae7e621ec" # x64
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/nikuscs/glooit/releases/download/v#{version}/glooit-linux-x64"
      sha256 "3175a40e02ab75268dc88b56919487755db6fcc17ef313ca19cb929d0f83a11d" # linux
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
