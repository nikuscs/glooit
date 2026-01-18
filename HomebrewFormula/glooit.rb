class Glooit < Formula
  desc "Sync AI coding assistant configurations across Claude, Cursor, OpenCode, Codex"
  homepage "https://github.com/nikuscs/glooit"
  version "0.6.5"
  license "MIT"

  on_macos do
    on_arm do
      url "https://github.com/nikuscs/glooit/releases/download/v#{version}/glooit-darwin-arm64"
      sha256 "69fc9aceaa8e4e89744773686d4f150d72477e81244abb4226736fe1cda305ac" # arm64
    end
    on_intel do
      url "https://github.com/nikuscs/glooit/releases/download/v#{version}/glooit-darwin-x64"
      sha256 "49b1af4d03b5af9d55e4714004a8310945d77c04c67f1b462fed250a80521c5f" # x64
    end
  end

  on_linux do
    on_intel do
      url "https://github.com/nikuscs/glooit/releases/download/v#{version}/glooit-linux-x64"
      sha256 "27d34148a64106e8dba7fc89a545214fc8b14422db951987e16e2a0465e753ca" # linux
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
