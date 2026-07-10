const fs = require('fs')
const path = require('path')
const axios = require('axios')
const FormData = require('form-data')

const DEFAULT_BASE_URL = 'http://192.168.201.19:3000'
const DEFAULT_KEY = 'wa-187-gw'

function printUsage() {
    console.log(`
Usage:
  node scripts/sendAxios.js upload --file ./Media/img.jpg
  node scripts/sendAxios.js image --to 62812xxxx --file ./Media/img.jpg --caption "caption"
  node scripts/sendAxios.js video --to 62812xxxx --file ./Media/video.mp4 --caption "caption"
  node scripts/sendAxios.js note --to 62812xxxx --message "isi pesan"
  node scripts/sendAxios.js file --to 62812xxxx --file ./Media/doc.pdf --filename doc.pdf

Options:
  --baseUrl   Default: ${DEFAULT_BASE_URL}
  --key       Default: ${DEFAULT_KEY}
  --to        Nomor tujuan untuk endpoint WhatsApp
  --file      Path file image/video/document
  --caption   Caption untuk image/video
  --message   Isi text/note
  --filename  Nama file untuk document
`)
}

function readArgs(argv) {
    const args = {
        type: argv[2],
        baseUrl: DEFAULT_BASE_URL,
        key: DEFAULT_KEY,
    }

    for (let i = 3; i < argv.length; i += 2) {
        const key = argv[i]
        const value = argv[i + 1]
        if (!key || !key.startsWith('--')) continue
        args[key.slice(2)] = value
    }

    return args
}

function requireArg(args, key) {
    if (!args[key]) {
        throw new Error(`Argumen --${key} wajib diisi`)
    }
}

function resolveFile(filePath) {
    const fullPath = path.resolve(filePath)
    if (!fs.existsSync(fullPath)) {
        throw new Error(`File tidak ditemukan: ${fullPath}`)
    }
    return fullPath
}

async function postMultipart(url, fields, filePath) {
    const form = new FormData()

    Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined && value !== '') form.append(key, value)
    })

    if (filePath) {
        const fullPath = resolveFile(filePath)
        form.append('file', fs.createReadStream(fullPath), path.basename(fullPath))
    }

    const res = await axios.post(url, form, {
        headers: form.getHeaders(),
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
    })

    return res.data
}

async function main() {
    const args = readArgs(process.argv)
    const baseUrl = args.baseUrl.replace(/\/$/, '')

    if (!args.type || ['-h', '--help', 'help'].includes(args.type)) {
        printUsage()
        return
    }

    let data

    if (args.type === 'upload') {
        requireArg(args, 'file')
        data = await postMultipart(`${baseUrl}/upload`, {}, args.file)
    } else if (args.type === 'image') {
        requireArg(args, 'to')
        requireArg(args, 'file')
        data = await postMultipart(
            `${baseUrl}/message/image?key=${encodeURIComponent(args.key)}`,
            { id: args.to, caption: args.caption },
            args.file
        )
    } else if (args.type === 'video') {
        requireArg(args, 'to')
        requireArg(args, 'file')
        data = await postMultipart(
            `${baseUrl}/message/video?key=${encodeURIComponent(args.key)}`,
            { id: args.to, caption: args.caption },
            args.file
        )
    } else if (args.type === 'file') {
        requireArg(args, 'to')
        requireArg(args, 'file')
        data = await postMultipart(
            `${baseUrl}/message/doc?key=${encodeURIComponent(args.key)}`,
            { id: args.to, filename: args.filename || path.basename(args.file) },
            args.file
        )
    } else if (args.type === 'note') {
        requireArg(args, 'to')
        requireArg(args, 'message')
        const res = await axios.post(
            `${baseUrl}/message/text?key=${encodeURIComponent(args.key)}`,
            {
                id: args.to,
                message: args.message,
            }
        )
        data = res.data
    } else {
        throw new Error(`Type tidak dikenal: ${args.type}`)
    }

    console.log(JSON.stringify(data, null, 2))
}

main().catch((err) => {
    const data = err.response?.data
    console.error(data ? JSON.stringify(data, null, 2) : err.message)
    process.exit(1)
})
