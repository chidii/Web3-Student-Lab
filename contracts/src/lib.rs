#![no_std]

use soroban_sdk::{contract, contractimpl, contracttype, symbol_short, Env, String, Symbol};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Certificate {
    pub student: String,
    pub course_name: String,
    pub issue_date: u64,
}

const CERTIFICATE: Symbol = symbol_short!("CERT");

#[contract]
pub struct CertificateContract;

#[contractimpl]
impl CertificateContract {
    /// Issue a new certificate to a student for a specific course.
    pub fn issue(env: Env, student: String, course_name: String) -> Certificate {
        let issue_date = env.ledger().timestamp();
        
        let cert = Certificate {
            student,
            course_name,
            issue_date,
        };

        // Store the certificate in the contract's instance storage
        // In a real application, you might use a map to store multiple certificates by student ID
        env.storage().instance().set(&CERTIFICATE, &cert);

        cert
    }

    /// Retrieve the currently stored certificate.
    pub fn get_certificate(env: Env) -> Certificate {
        env.storage().instance().get(&CERTIFICATE).unwrap()
    }
}
