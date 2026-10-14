document.getElementById("year").textContent = new Date().getFullYear();

const navToggle = document.getElementById("navToggle");
const navLinks = document.querySelector(".nav-links");
navToggle?.addEventListener("click", () => {
  const isOpen = navLinks.style.display === "flex";
  navLinks.style.display = isOpen ? "none" : "flex";
  navLinks.style.flexDirection = "column";
  navLinks.style.position = "absolute";
  navLinks.style.top = "72px";
  navLinks.style.left = "0";
  navLinks.style.right = "0";
  navLinks.style.background = "#F3F8F9";
  navLinks.style.padding = "20px 24px";
  navLinks.style.borderBottom = "1px solid #D7E5E8";
  navLinks.style.gap = "18px";
});

const revealTargets = document.querySelectorAll(".reveal");
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      }
    }
  },
  { threshold: 0.15 }
);
revealTargets.forEach((el) => observer.observe(el));
