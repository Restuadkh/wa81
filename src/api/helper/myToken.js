module.exports = function myToken(mx, nsc = 0, clientId = '?') {
    if (mx.length < 5 || mx.length > 210)
        return clientId

    let ct = mx.replace(/^(\s|#|\u00A0)+|(\s|#|\u00A0)+$/g, "").toLowerCase().replace(/[^0-9^a-z^#]|pagi/g, "")

    if (nsc < 8_000 || nsc > 86_390_000)
        if (/reha|fisio/.test(ct) && (/fisio|thera|terap|upasi|icara|imam/s.test(ct))) {
            const ci = ct.match(/#\d+#/g)   // ct.match(/[a-z]+#\d+/g)
            if (ci && ci[0]) {
                ct = `ut.11..${ci[0]}`
                // ls = ci[0].split('#')
                // if (ls.length > 1) {
                //     if (/oku|pasi/.test(ls[0]))
                //         ct = `ut.11.to#${ls[1]}`
                //     else if (/cara/.test(ls[0]))
                //         ct = `ut.11.tw#${ls[1]}`
                //     else if (/fisio|rapi/.test(ls[0]))
                //         ct = `ut.11.tf#${ls[1]}`
                //     else if (/dr|ima|mar/.test(ls[0]))
                //         ct = `ut.11.dr#${ls[1]}`
                //     else
                //         ct = `ut.11.${ci[0]}`
                // }
            }
        }
    return ct
}