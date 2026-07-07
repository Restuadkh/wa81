module.exports = function validPhnNumber(cp) {
    let nl,
        cn = `${cp}`.replace(/\D/g, '')
    if (cp.includes('@s.whatsapp.net')) {
        return cp
    }
    if (cp.endsWith('@lid@s.whatsapp.net')) {
        cp = cp.replace(/@s.whatsapp.net/g, '') // tanpa validasi panjang
    }
    if (cp.endsWith('@lid')) {
        // cn += '@s.whatsapp.net'
        // console.log("validPhnNumber(cp) :", cp)
        return cp
    }
    if (cn.charAt(0) == '8') cn = '62' + cn
    if (cn.charAt(0) == '0') cn = '62' + cn.substring(1)
    nl = cn.length
    if (cn.charAt(0) === '6' && nl > 9 && nl < 17) {
        cn += '@s.whatsapp.net'
    } else {
        cn = ''
        console.log(`Invalid phone number "${cp}" --> "${cn}" |${nl}\n`)
        throw new Error(`Invalid phone number "${cp}"`)
    }
    // console.log("validPhnNumber(cp) :", cn)
    return cn
}
