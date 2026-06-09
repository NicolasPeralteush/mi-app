(function () {
  "use strict";

  const scrollTopBtn = document.getElementById("scrollTop");

  window.addEventListener("scroll", function () {
    if (window.scrollY > 400) {
      scrollTopBtn.classList.add("show");
    } else {
      scrollTopBtn.classList.remove("show");
    }
  });

  const form = document.querySelector("form[action='/contacto']");
  if (form) {
    form.addEventListener("submit", function (e) {
      const btn = form.querySelector("button[type='submit']");
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...';
    });
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("enviado") === "ok") {
    const alerta = document.createElement("div");
    alerta.className = "alert alert-success alert-dismissible fade show mt-3";
    alerta.innerHTML =
      '<i class="bi bi-check-circle me-2"></i>Mensaje enviado con éxito. Te contactaremos pronto.' +
      '<button type="button" class="btn-close" data-bs-dismiss="alert"></button>';
    form.prepend(alerta);
  }

  const nav = document.getElementById("mainNav");
  if (nav) {
    const navLinks = nav.querySelectorAll(".nav-link");
    const sections = document.querySelectorAll("section[id]");

    window.addEventListener("scroll", function () {
      let current = "";
      sections.forEach((section) => {
        const top = section.offsetTop - 150;
        if (window.scrollY >= top) {
          current = section.getAttribute("id");
        }
      });

      navLinks.forEach((link) => {
        link.classList.remove("active");
        if (link.getAttribute("href") === "#" + current) {
          link.classList.add("active");
        }
      });
    });
  }

  const observerOptions = {
    threshold: 0.1,
    rootMargin: "0px 0px -50px 0px",
  };

  const observer = new IntersectionObserver(function (entries) {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = "1";
        entry.target.style.transform = "translateY(0)";
      }
    });
  }, observerOptions);

  document.querySelectorAll("[data-aos]").forEach((el) => {
    el.style.opacity = "0";
    el.style.transform = "translateY(30px)";
    el.style.transition = "opacity 0.6s ease, transform 0.6s ease";
    observer.observe(el);
  });
})();
