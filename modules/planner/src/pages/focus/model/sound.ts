// One context for the page's lifetime. Browsers start a context made outside a click suspended, and a chime is
// played from a timer: so it is made, or resumed, in the click that starts the block, and never closed.
let audio: AudioContext | null = null

/** Call from a click or a key press: it lets the chime at the end of the block be heard. */
export function unlockSound() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') void audio.resume()
  } catch {
    // no audio here
  }
}

/** Two short notes. Where sound is not allowed it stays silent: the page says it in words too. */
export function chime() {
  try {
    audio ??= new AudioContext()
    for (const [index, frequency] of [660, 880].entries()) {
      const tone = audio.createOscillator()
      const volume = audio.createGain()
      const at = audio.currentTime + index * 0.18
      tone.frequency.value = frequency
      volume.gain.setValueAtTime(0.0001, at)
      volume.gain.exponentialRampToValueAtTime(0.2, at + 0.02)
      volume.gain.exponentialRampToValueAtTime(0.0001, at + 0.16)
      tone.connect(volume).connect(audio.destination)
      tone.start(at)
      tone.stop(at + 0.17)
    }
  } catch {
    // no audio here
  }
}
