// The code below is a slightly edited version of this: https://github.com/tensorflow/tfjs-models/blob/master/universal-sentence-encoder/src/tokenizer/index.ts

/**
 * @license
 * Copyright 2019 Google LLC. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
/**
 * Tokenizer.encode() is a port of `EncodeAsIds` from the SentencePiece library
 * (https://github.com/google/sentencepiece). Encode uses the Viterbi algorithm
 * to find the most likely sequence of tokens that comprise the input. For more
 * details, refer to https://arxiv.org/pdf/1804.10959.pdf.
 */

const separator = '\u2581'; // This is the unicode character 'lower one eighth block'.
function processInput(str) {
    const normalized = str.normalize('NFKC');
    return normalized.length > 0 ?
        separator + normalized.replace(/ /g, separator) :
        normalized;
}

// The first tokens are reserved for unk, control symbols, and user-defined
// symbols.
const RESERVED_SYMBOLS_COUNT = 6;
export class Tokenizer {
    constructor(vocabulary, reservedSymbolsCount = RESERVED_SYMBOLS_COUNT) {
        this.vocabulary = vocabulary;
        this.reservedSymbolsCount = reservedSymbolsCount;
        this.trie = new Trie();
        for (let i = this.reservedSymbolsCount; i < this.vocabulary.length; i++) {
            this.trie.insert(this.vocabulary[i][0], this.vocabulary[i][1], i);
        }
    }
    encode(input) {
        const nodes = [];
        const words = [];
        const best = [];
        input = processInput(input);
        const symbols = stringToChars(input);
        for (let i = 0; i <= symbols.length; i++) {
            nodes.push({});
            words.push(0);
            best.push(0);
        }
        // Construct the lattice.
        for (let i = 0; i < symbols.length; i++) {
            const matches = this.trie.commonPrefixSearch(symbols.slice(i));
            for (let j = 0; j < matches.length; j++) {
                const piece = matches[j];
                const obj = { key: piece[0], score: piece[1], index: piece[2] };
                const endPos = piece[0].length;
                if (nodes[i + endPos][i] == null) {
                    nodes[i + endPos][i] = [];
                }
                nodes[i + endPos][i].push(obj);
            }
        }
        for (let endPos = 0; endPos <= symbols.length; endPos++) {
            for (const startPos in nodes[endPos]) {
                const arr = nodes[endPos][startPos];
                for (let j = 0; j < arr.length; j++) {
                    const word = arr[j];
                    const score = word.score + best[endPos - word.key.length];
                    if (best[endPos] === 0 || score >= best[endPos]) {
                        best[endPos] = score;
                        words[endPos] = arr[j].index;
                    }
                }
            }
        }
        const results = [];
        // Backward pass.
        let iter = words.length - 1;
        while (iter > 0) {
            results.push(words[iter]);
            iter -= this.vocabulary[words[iter]][0].length;
        }
        // Merge consecutive unks.
        const merged = [];
        let isPreviousUnk = false;
        for (let i = 0; i < results.length; i++) {
            const id = results[i];
            if (!(isPreviousUnk && id === 0)) {
                merged.push(id);
            }
            isPreviousUnk = id === 0;
        }
        return merged.reverse();
    }
}

/**
 * Load the Tokenizer for use independently from the UniversalSentenceEncoder.
 *
 * @param pathToVocabulary (optional) Provide a path to the vocabulary file.
 */
export async function loadTokenizer(pathToVocabulary) {
    const vocabulary = await loadVocabulary(pathToVocabulary);
    const tokenizer = new Tokenizer(vocabulary);
    return tokenizer;
}

/**
 * Load a vocabulary for the Tokenizer.
 *
 * @param pathToVocabulary Defaults to the path to the 8k vocabulary used by the
 * UniversalSentenceEncoder.
 */
export async function loadVocabulary(pathToVocabulary) {
    const vocabulary = await fetch(pathToVocabulary);
    return vocabulary.json();
}




const stringToChars = (input) => {
    const symbols = [];
    for (const symbol of input) {
        symbols.push(symbol);
    }
    return symbols;
};




class TrieNode {
    constructor() {
        this.parent = null;
        this.children = {};
        this.end = false;
        this.word = [[], 0, 0];
    }
}
export class Trie {
    constructor() {
        this.root = new TrieNode();
    }
    /**
     * Inserts a token into the trie.
     */
    insert(word, score, index) {
        let node = this.root;
        const symbols = stringToChars(word);
        for (let i = 0; i < symbols.length; i++) {
            if (!node.children[symbols[i]]) {
                node.children[symbols[i]] = new TrieNode();
                node.children[symbols[i]].parent = node;
                node.children[symbols[i]].word[0] = node.word[0].concat(symbols[i]);
            }
            node = node.children[symbols[i]];
            if (i === symbols.length - 1) {
                node.end = true;
                node.word[1] = score;
                node.word[2] = index;
            }
        }
    }
    /**
     * Returns an array of all tokens starting with ss.
     *
     * @param ss The prefix to match on.
     */
    commonPrefixSearch(ss) {
        const output = [];
        let node = this.root.children[ss[0]];
        for (let i = 0; i < ss.length && node; i++) {
            if (node.end) {
                output.push(node.word);
            }
            node = node.children[ss[i + 1]];
        }
        if (!output.length) {
            output.push([[ss[0]], 0, 0]);
        }
        return output;
    }
}
