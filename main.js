const harmonics = [
  0.500084025188092,
  0.2123884537885293,
  0.19851414191321148,
  0.17568608600823968,
  0.15716936697031025,
  0.1470014276846641,
  0.13855474089857536,
  // 0.138264636761106,
  // 0.13327096318584894,
  // 0.13179678717527823,
  // 0.12871505454081028,
  // higher harmonics
  // 0.1259528777427678,
  // 0.1244836777427678,
  // 0.1234528777427678,
  // 0.1229528777427678,
  // 0.1224836777427678,
  // 0.1219528777427678,
  // 0.1214836777427678,
  // 0.1209528777427678,
  // 0.1204836777427678,
  // 0.1199528777427678
].map((n, i) => n * 3 ** -Math.pow(i + 1, .75));
// const harmonics = Array(6).fill(0).map((_, i) => 2 ** -i / 4);
const harmonicsSum = harmonics.reduce((acc, n) => acc + n, 0);
const decayFactor = -.0010;
const noteOffsets = {
  "C": 0,
  "D": 2,
  "E": 4,
  "F": 5,
  "G": 7,
  "A": 9,
  "B": 11
};
const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const whiteNotes = ["C", "D", "E", "F", "G", "A", "B"];
const blackNotes = ["C#", "D#", "F#", "G#", "A#"];
const defaultRange = ["C3", "B5"];

const NOTE_WIDTH = 40;
const NOTE_HEIGHT = 200;
const BLACK_NOTE_WIDTH = 25;
const BLACK_NOTE_HEIGHT = 120;
// black note layout offset
const BNLO = 1 - BLACK_NOTE_WIDTH / NOTE_WIDTH / 2;
const noteLayoutIndices = [0, BNLO, 1, 1 + BNLO, 2, 3, 3 + BNLO, 4, 4 + BNLO, 5, 5 + BNLO, 6];

/*
class Note {
  constructor(frequency, duration, sampleRate = 44100) {
    this.frequency = frequency;
    this.duration = duration;
    this.currentIndex = 0;
    this.sampleRate = sampleRate;
    this.ringBuffer = new Float32Array(Math.ceil(sampleRate / frequency));
  }

  tick() {
    if (this.currentIndex == 0) {
      for (let i = 0; i < this.ringBuffer.length; i++) {
        this.ringBuffer[i] = (Math.random() * 2 - 1);
      }
    }
    // cycle samples
    // const rbIndex = this.currentIndex % this.ringBuffer.length;
    // const sample = this.ringBuffer[rbIndex];
    // this.ringBuffer[rbIndex] = (this.ringBuffer[rbIndex] + this.ringBuffer[(rbIndex + 1) % this.ringBuffer.length]) / 2 * .997;
    const x = this.currentIndex / this.sampleRate;
    const sample = harmonics.reduce((acc, n, i) => acc + Math.sin(x * Math.PI * 2 * this.frequency * (i + 1)) * n, 0) * Math.pow(.993, x * this.frequency);
    this.currentIndex++;
    return sample;
  }
}
*/

/**
 * @param {string} pitch Pitch notation, ex: A4, C2, E♭4, D#4
 * @returns frequency in Hz
*/
function parseNote(pitch) {
  return noteIndexToFrequency(parseNoteIndex(pitch));
}

/**
 * @param {number} noteIndex index of note in chromatic scale, where A4 = 57
 * @returns frequency in Hz
 */
function noteIndexToFrequency(noteIndex) {
  return 440 * Math.pow(2, (noteIndex - 57) / 12);
}

/**
 * @param {string} pitch Pitch notation, ex: A4, C2, E♭4, D#4
 * @returns index of note in chromatic scale, where A4 = 57
 */
function parseNoteIndex(pitch) {
  pitch = pitch.toUpperCase();
  if (!pitch.match(/[A-G][#♭]?[0-9]/))
    throw "Invalid pitch notation";
  const note = pitch.substring(0, pitch.length - 1);
  const octave = parseInt(pitch.substring(pitch.length - 1));
  const offset = note.length === 2 ? (note[1] === "#" ? 1 : -1) : 0;
  return noteOffsets[note[0]] + offset + 12 * octave;
}

function noteIndexToLayoutIndex(noteIndex, range = defaultRange) {
  const startIndex = parseNoteIndex(range[0]);
  return noteLayoutIndices[(noteIndex - startIndex) % 12] + 7 * Math.floor((noteIndex - startIndex) / 12);
}

function noteToString(noteIndex) {
  return notes[noteIndex % 12] + Math.floor(noteIndex / 12);
}

function isBlackNote(noteIndex) {
  return noteIndex % 12 === 1 || noteIndex % 12 === 3 || noteIndex % 12 === 6 || noteIndex % 12 === 8 || noteIndex % 12 === 10;
}

/**
 * @param {number} frequency note frequency in Hz
 * @param {number} duration duration of the sample in seconds
 * @param {number?} sampleRate number of samples per second
 * @returns array of samples
 */
function getNoteBufferData(frequency, duration, sampleRate = 44100) {
  const w = 2 * Math.PI * frequency;
  return Array(sampleRate * duration).fill(3 * Math.pow(440 / w, .4)).map((mult, x) => {
    const t = x / sampleRate;
    
    // piano
    let y = mult * harmonics.reduce((acc, n, i) => acc + n * Math.sin((i + 1) * w * t), 0) * Math.exp(decayFactor * w * t);
    y += y * y * y;
    y *= 1 + 16 * t * Math.exp(-6 * t);
    
    // saw wave
    // let y = (.5 - 1/Math.PI * harmonics.reduce((acc, _, i) => acc + (-1) ** (i + 1) * Math.sin(w * (i + 1) * t) / (i + 1), 0)) * Math.exp(-3 * t) * .5;
    return y;
  });
}

function playNote(pitch, duration = 2) {
  const audioCtx = new AudioContext();
  if (audioCtx.state === "suspended")
    audioCtx.resume();
  
  const frequency = typeof pitch === "number" ? noteIndexToFrequency(pitch) : parseNote(pitch);
  const buffer = audioCtx.createBuffer(1, Math.ceil(audioCtx.sampleRate * duration), audioCtx.sampleRate);
  const bufferData = buffer.getChannelData(0);
  // bufferData.forEach((_, x) => bufferData[x] = harmonics.reduce((acc, n, i) => acc + Math.sin(x / audioCtx.sampleRate * Math.PI * 2 * frequency * (i + 1)) * n, 0) * Math.pow(.985, x / audioCtx.sampleRate * 200));
  // console.time("noteStart");
  getNoteBufferData(frequency, duration, audioCtx.sampleRate).forEach((val, i) => bufferData[i] = val);
  // console.timeEnd("noteStart");
  
  // const note = new Note(frequency, duration, audioCtx.sampleRate);
  // for (let i = 0; i < bufferData.length; i++) {
  //   bufferData[i] = note.tick();
  // }
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start();
  source.onended = () => audioCtx.close();
}

function playChord(pitches, duration = 2) {
  const audioCtx = new AudioContext();
  if (audioCtx.state === "suspended")
    audioCtx.resume();

  const buffer = audioCtx.createBuffer(1, Math.ceil(audioCtx.sampleRate * duration), audioCtx.sampleRate);
  const bufferData = buffer.getChannelData(0);
  
  pitches.forEach(pitch => {
    const frequency = typeof pitch === "number" ? pitch : parseNote(pitch);
    getNoteBufferData(frequency, duration, audioCtx.sampleRate).forEach((val, i) => bufferData[i] += val * .2);
  })
  
  // const note = new Note(frequency, duration, audioCtx.sampleRate);
  // for (let i = 0; i < bufferData.length; i++) {
  //   bufferData[i] = note.tick();
  // }
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  source.start();
  source.onended = () => audioCtx.close();
}

async function playMelody(melody) {
  return await new Promise((res, rej) => {
    try {
      let i = 0;
      function playNextNote() {
        if (i >= melody.length) {
          res();
          return;
        }
        playNote(melody[i]);
        i++;
        setTimeout(playNextNote, 600);
      }
      playNextNote();
    }
    catch (e) {
      rej(e);
    }
  });
}

function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateMelody(range = defaultRange, length = 5, maxStep = 12) {
  const startIndex = parseNoteIndex(range[0]), endIndex = parseNoteIndex(range[1]);
  const melody = [randomIntInclusive(startIndex, endIndex)];
  for (let i = 1; i < length; i++) {
    melody.push(randomIntInclusive(Math.max(startIndex, melody[i - 1] - maxStep), Math.min(endIndex, melody[i - 1] + maxStep)));
  }
  return melody;
}

class Note {
  /**
   * Constructor
   * @param {number} noteIndex NoteIndex
   * @param {number} layoutIndex Number to multiply by NOTE_WIDTH to get x position, can be decimal
   * @param {CanvasRenderingContext2D} ctx
   */
  constructor(noteIndex, layoutIndex, ctx) {
    this.noteIndex = noteIndex;
    this.layoutIndex = layoutIndex;
    this.ctx = ctx;
    this.noteName = noteToString(noteIndex);
    this.isMouseDown = false;
    this.blackNote = isBlackNote(noteIndex);
    this.x = layoutIndex * NOTE_WIDTH + 1;
    this.y = 1;
    if (this.blackNote) {
      this.width = BLACK_NOTE_WIDTH;
      this.height = BLACK_NOTE_HEIGHT;
    }
    else {
      this.width = NOTE_WIDTH;
      this.height = NOTE_HEIGHT;
    }
    this.customArgs = {};
  }

  /**
   * Draw the note
   */
  draw(customArgs) {
    // override custom args if given
    this.customArgs = customArgs || this.customArgs;
    if (this.blackNote) {
      this.ctx.fillStyle = this.isMouseDown ? "#333" : "black";
      this.ctx.fillRect(this.x, this.y, this.width, this.height);
    }
    else {
      this.ctx.fillStyle = this.isMouseDown ? "#ddd" : "white";
      this.ctx.fillRect(this.x, this.y, this.width, this.height);
      this.ctx.strokeStyle = "black";
      this.ctx.strokeRect(this.x, this.y, this.width, this.height);
    }
    if (this.customArgs.showNoteName) {
      this.ctx.fillStyle = this.blackNote ? "white" : "black";
      this.ctx.font = "24px Calibri";
      
      const offset = this.width / 2 - this.ctx.measureText(this.noteName).width / 2;
      this.ctx.fillText(this.noteName, this.x + offset, this.height - 10);
    }
  }

  mouseDown() {
    this.isMouseDown = true;
    this.draw();
  }

  mouseUp() {
    this.isMouseDown = false;
    this.draw();
  }
}

class Keyboard {
  /**
   * Constructor
   * @param {CanvasRenderingContext2D} ctx 
   * @param {CanvasRenderingContext2D} blackCtx 
   * @param {string[]} range 
   */
  constructor(ctx, blackCtx, notePressedCallback = () => {}, range = defaultRange) {
    this.ctx = ctx;
    this.blackCtx = ctx;
    this.notePressedCallback = notePressedCallback;
    this.range = range;
    const startIndex = parseNoteIndex(range[0]), endIndex = parseNoteIndex(range[1]);
    this.startIndex = startIndex;
    this.endIndex = endIndex;
    this.startLayoutIndex = noteIndexToLayoutIndex(startIndex, range);
    this.endLayoutIndex = noteIndexToLayoutIndex(endIndex, range);
    this.numLayoutIndex = this.endLayoutIndex - this.startLayoutIndex + 1;
    const n = endIndex - startIndex + 1;
    this.notes = Array(n).fill(0).map((_, i) => new Note(startIndex + i, noteIndexToLayoutIndex(startIndex + i, range), isBlackNote(startIndex + i) ? blackCtx : ctx));
    this.whiteNotes = this.notes.filter(note => !note.blackNote);
    this.blackNotes = this.notes.filter(note => note.blackNote);
    ctx.canvas.width = this.numLayoutIndex * NOTE_WIDTH + 2;
    ctx.canvas.height = NOTE_HEIGHT + 2;
    blackCtx.canvas.width = ctx.canvas.width;
    blackCtx.canvas.height = ctx.canvas.height;
    this.lastPlayedNote = null;
  }

  drawAll(customArgs = {}) {
    this.ctx.fillStyle = "black";
    this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
    this.ctx.lineWidth = 1;
    this.whiteNotes.forEach(note => note.draw(customArgs[note.noteName] || {}));
    this.blackNotes.forEach(note => note.draw(customArgs[note.noteName] || {}));
  }

  /**
   * Returns the note (or null) at the given position
   * @param {number} x 
   * @param {number} y 
   * @returns note string or null
   */
  getNoteAtPosition(x, y) {
    if (x <= 0 || x >= this.numLayoutIndex * NOTE_WIDTH + 1)
      return null;
    // rounded down to match the white note
    const layoutIndex = Math.floor((x - 1) / NOTE_WIDTH);
    // where the mouse really is
    const rawLayoutIndex = (x - 1) / NOTE_WIDTH;
    // start checking if black note
    let aboveWhiteNote = false;
    if ((rawLayoutIndex - layoutIndex > BNLO || (aboveWhiteNote = rawLayoutIndex - layoutIndex < 1 - BNLO)) && y <= BLACK_NOTE_HEIGHT) {
      // normalize
      const adjustedLayoutIndex = aboveWhiteNote ? layoutIndex - 1 : layoutIndex;
      // if black note
      switch (adjustedLayoutIndex % 7) {
        case 0:
        case 1:
        case 3:
        case 4:
        case 5:
          return whiteNotes[adjustedLayoutIndex % 7] + "#" + (Math.floor(adjustedLayoutIndex / 7) + 3);
      }
    }
    return whiteNotes[layoutIndex % 7] + (Math.floor(layoutIndex / 7) + 3);
  }

  handleMouseDown(x, y) {
    const note = this.getNoteAtPosition(x, y);
    if (note) {
      this.notePressedCallback(parseNoteIndex(note));
      playNote(note);
      // playChord([parseNote(note), parseNote(note) * 1.25, parseNote(note) * 1.5, parseNote(note) * 2]);
      this.lastPlayedNote = parseNoteIndex(note) - this.startIndex;
      const noteObj = this.notes[this.lastPlayedNote];
      noteObj.mouseDown();
    }
  }

  handleMouseUp(x, y) {
    const note = this.getNoteAtPosition(x, y);
    if (note) {
      const noteObj = this.notes[parseNoteIndex(note) - this.startIndex];
      noteObj.mouseUp();
    }
    if (this.lastPlayedNote !== null) {
      this.notes[this.lastPlayedNote].mouseUp();
      this.lastPlayedNote = null;
    }
  }
}

// abstract class
class Game {
  constructor() {
    const canvas = document.getElementById("main-canvas");
    const blackCanvas = document.getElementById("black-canvas");
    const ctx = canvas.getContext("2d");
    const blackCtx = blackCanvas.getContext("2d");
    this.keyboard = new Keyboard(ctx, blackCtx, this.notePressedCallback.bind(this));
    this.keyboard.drawAll();
    this.isPlayingSequence = false;
    this.correct = 0;
    this.incorrect = 0;
    this.streak = 0;
  }

  onMouseDown(event) {
    this.keyboard.handleMouseDown(event.offsetX, event.offsetY);
  }

  onMouseUp(event) {
    this.keyboard.handleMouseUp(event.offsetX, event.offsetY);
  }

  updateUI() {
    document.getElementById("score").innerText = `${this.correct} out of ${this.correct + this.incorrect}`;
    document.getElementById("streak").innerText = `Streak: ${this.streak}`;
    document.getElementById("accuracy").innerText = `Accuracy: ${Math.round(this.getAccuracy() * 100)}%`;
    document.getElementById("advance-status").innerText = this.canAdvance() ? "Click button to advance" : "";
  }
  
  onSuccess() {
    this.streak++;
    this.correct++;
    this.updateUI();
  }

  onFail() {
    this.streak = 0;
    this.incorrect++;
    this.updateUI();
  }

  getAccuracy() {
    return this.correct / Math.max(1, this.correct + this.incorrect);
  }

  // abstract
  // whether or not the game can advance to the next round (finished with current round)
  canAdvance() {}

  // abstract
  notePressedCallback(noteIndex) {}

  // abstract
  startNewRound() {}

  // abstract
  playSequence() {}
}

class MelodyGame extends Game {
  updateUI() {
    super.updateUI();
    document.getElementById("game-status").innerText = this.melody.map(noteToString).map((val, i) => i === 0 || i < this.melodyCorrect ? val : "?").join("-");
  }

  canAdvance() {
    return this.melodyCorrect >= this.melody.length;
  }
  
  notePressedCallback(noteIndex) {
    if (!this.melody)
      return;
    if (this.melodyCorrect < this.melody.length) {
      if (noteIndex === this.melody[this.melodyCorrect]) {
        this.melodyCorrect++;
        if (this.melodyCorrect === this.melody.length && this.melodyCurrentlyCorrect) {
          this.onSuccess();
        }
        else {
          // put this in else to prevent redundant calls to updateUI
          this.updateUI();
        }
      }
      else {
        if (this.melodyCurrentlyCorrect) {
          this.onFail();
          this.melodyCurrentlyCorrect = false;
        }
      }
    }
  }

  // start new round
  startNewRound() {
    this.melody = generateMelody();
    // the number of correct notes so far in the current round
    this.melodyCorrect = 0;
    this.melodyCurrentlyCorrect = true;
    this.updateUI();
    this.keyboard.drawAll({[noteToString(this.melody[0])]: {showNoteName: true}});
  }

  playSequence() {
    if (!this.isPlayingSequence) {
      this.isPlayingSequence = true;
      if (!this.melody || this.canAdvance())
        this.startNewRound();
      playMelody(this.melody).then(() => this.isPlayingSequence = false);
    }
  }
}

// connect events
let game;

function onMouseDown(event) {
  game.onMouseDown(event);
}

function onMouseUp(event) {
  game.onMouseUp(event);
}

function init() {
  game = new MelodyGame();
}