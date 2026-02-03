function validPhnNumber(cp) {
    var cn = ("" + cp).replace(/\D/g, "")
    if (cn.charAt(0) == '0') cn = '62' + cn.substring(1)
    if (cn.charAt(0) == '8') cn = '62' + cn
    let nl = cn.length
    if (nl > 10 && nl < 17) {
        cn += '@s.whatsapp.net'
    } else {
        console.log('Invalid phn number:' + cp, '->', cn, ':: len:', nl)
        cn = ''
    }
    return cn
}

function stringTrim(s) {
    return s.replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, "")
}

function waIdToPhnNumber(id) {
    let phnNum = ("" + id).replace(/\D/g, "")
    return `+${phnNum.substring(0, 2)} ${phnNum.substring(2, 5)}-${phnNum.substring(5, 9)}-${phnNum.substring(9)}`
}

function cTimeStamp(unix_timestamp = null, nlength = 23) {
    let d1
    try {
        // d1 = unix_timestamp ? new Date(unix_timestamp * 1000) : new Date()
        // d1 = new Date(d1.getTime() - (d1.getTimezoneOffset() * 60 * 1000))
        // d1 = new Date(d1.getTime() + 25_200_000)
        d1 = unix_timestamp ?? (new Date()).getTime()
        d1 = new Date(d1 + 25_200_000)
    } catch (err) {
        console.log('timestamp error ', err)
        d1 = new Date()
        // d1 = new Date(d1.getTime() - (d1.getTimezoneOffset() * 60 * 1000))
        d1 = new Date(d1.getTime() + 25_200_000)
    }
    return d1.toISOString().replace(/T/, " ").substring(0, nlength)
}

function isFontStandart(c) {
    let c0 = c.substring(0, 12).replace(/[#-z]/g, "")
    let c1 = c.substring(0, 12).replace(/[^#-z]/g, "")
    if (c1.length >= 11)
        return ''
    else if (c0.length - c1.length >= 12)
        return 'Agar text anda terbaca oleh sistem,\nharap menggunakan *Font yang standart*'
    else return ''
    // let n = 0
    // for (let i = 0; i < c.length; i++) {
    //     if (c.charCodeAt(i) > 9999) {
    //         n++
    //         console.log(i, n, c[i], c.charCodeAt(i))
    //         if (n > 11) break
    //     }
    // }
    // return (n > 9) ? 'Agar text anda terbaca oleh sistem,\nharap menggunakan *Font yang standart*' : ''
}

module.exports = { validPhnNumber, waIdToPhnNumber, stringTrim, cTimeStamp, isFontStandart }