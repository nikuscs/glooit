class Glooit < Formula
  desc "Sync AI coding assistant configurations across Claude, Cursor, OpenCode, Codex"
  homepage "https://github.com/nikuscs/glooit"
  version "0.6.6"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/nikuscs/glooit/releases/download/v#{version}/glooit-darwin-arm64"
      sha256 "3d1ab06c2b486dbbdd02fe326ad0d886636489a87e99bf54b1a8cd454ff1480b" # arm64
    end
    on_intel do
      url "https://github.com/nikuscs/glooit/releases/download/v#{version}/glooit-darwin-x64"
      sha256 "88936371326ea94aec04262207503e32c2270ca6fc50fcfcca6f0601577e5314" # x64
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/nikuscs/glooit/releases/download/v#{version}/glooit-linux-x64"
      sha256 "7fb0b45138435e610d9c046760a0b749d18b555c345643200939fde45e4e8bd0" # linux
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
