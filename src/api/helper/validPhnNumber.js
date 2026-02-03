module.exports = function validPhnNumber(cp) {
    let nl, cn = `${cp}`.replace(/\D/g, "")
    if (cn.charAt(0) == '8') cn = '62' + cn;
    if (cn.charAt(0) == '0') cn = '62' + cn.substring(1)
    nl = cn.length
    if (cn.charAt(0) === '6' && nl > 9 && nl < 18) {
        cn += '@s.whatsapp.net'
    } else {
        cn = ''
        console.log(`Invalid phone number "${cp}" --> "${cn}" |${nl}\n`)
        throw new Error(`Invalid phone number "${cp}"`)
    }
    return cn
}
