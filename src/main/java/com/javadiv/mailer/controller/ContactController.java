package com.javadiv.mailer.controller;

import com.javadiv.mailer.dto.ContactResponse;
import com.javadiv.mailer.dto.CreateContactRequest;
import com.javadiv.mailer.dto.ImportContactsResponse;
import com.javadiv.mailer.service.ContactService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/contacts")
public class ContactController {

    private final ContactService contactService;

    public ContactController(ContactService contactService) {
        this.contactService = contactService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ContactResponse create(@Valid @RequestBody CreateContactRequest request) {
        return contactService.create(request);
    }

    @PostMapping(value = "/import-lines", consumes = MediaType.TEXT_PLAIN_VALUE)
    public ImportContactsResponse importByLines(@RequestBody String linhasEmails) {
        return contactService.importByLines(linhasEmails);
    }

    @GetMapping
    public List<ContactResponse> list() {
        return contactService.listAll();
    }
}
