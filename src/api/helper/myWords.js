module.exports = function myWords(s) {
    let r
    switch (s) {
        case 'ping':
            r = '*pong*'
            break
        case 'pong':
            r = '*ping*'
            break
        case 'tes':
            r = '😁 Shiaap ..'
            break
        case 'test':
            r = '😁 Siaaap'
            break
        case 'nuwun':
            r = '🙂 sami sami'
            break
        case 'subhanallah':
            r = '🙏🏻'
            break
        case '?':
            r = '🤔'
            break
        default:
            const cc = s.replace(/[^a-z]/g, "")
            if (s.length == 1 && /[0-9A-Za-z]/.test(s)) {
                r = '😃 '
                let n = s.charCodeAt(0)
                if (n > 121) n = 96
                else if (n == 57) n = 47
                r += String.fromCharCode(n + 1)
            } else if (/'a{1,}mi{1,}n{1,}'/.test(s)) {
                r = '🙏🏻Aamiin'
            } else if (['caranya', 'carane'].includes(cc)) {
                r = 'cara apanya?'
            } else if (['benar', 'betul', 'iya', 'mksh', 'thx', 'maksih'].includes(cc)) {
                r = '🙂🙏🏻'
            } else if (['salah kirim', 'salah pencet'].includes(s)) {
                r = '🙈'
            } else if (['permisi', 'permisi kak', 'misi', 'misi kak', 'nyuwun sewu', 'nyuwunsewu', 'coba', 'cobo'].includes(s)) {
                r = 'Monggo 🙂'
            } else if (['mcu', 'info mcu'].includes(cc)) {
                r = '🤔Harap dilengkapi;\ndokter mcu\ndaftar #mcu #...'
                r += '\n\nUntuk informasi layanan, silakan WA ke:\n*Hotline RSUD-PS 0811-263-7570*'
            } else if (/pasi.{1}n baru|belum punya|blm punya/.test(s)) {
                r = '🙏Untuk pasien baru atau belum punya no.RM, hanya dapat dilayani di tempat pendaftaran di RS.'
            } else if (/\bh[ae]{1,}l{1,}o{1,}\b/.test(s)) {
                r = (s.includes("he")) ? "Heloo" : "Haloo" + ' juga 🙂'
            } else if (/pr{1,}e{1,}t{1,}/.test(s) || ['tai', 'asu', 'anjing', 'babi', 'pekok', 'setan'].includes(s)) {
                r = '🙈\nhttps://health.kompas.com/read/24E03075926068/kemarahan-singkat-bisa-meningkatkan-risiko-penyakit-jantung'
            } else if (/\?{2,}/.test(s)) {
                r = '🤔'
            }
            break
    }
    return r
}